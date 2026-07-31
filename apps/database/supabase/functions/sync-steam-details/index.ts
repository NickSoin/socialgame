import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import {
  applySteamAppDetails,
  fetchSteamAppDetails,
  fetchSteamStoreTags,
  SteamFetchError,
  type SteamAppDetails,
} from "../_shared/steam-app-details.ts";
import { authorizeScheduledRequest } from "../_shared/scheduled-auth.ts";

const DEFAULT_BATCH_SIZE = 180;
const MAX_BATCH_SIZE = 200;
const DETAILS_CONCURRENCY = 6;
const UPSERT_BATCH_SIZE = 100;
const RELEASE_REFRESH_MS = 30 * 60 * 60 * 1000;
const SLOW_REFRESH_MS = 8 * 24 * 60 * 60 * 1000;

type SteamGameRow = {
  steam_app_id: number;
  lifecycle_status: string;
  wishlist_rank: number | null;
  wishlist_estimate: string | null;
  is_wishlisted: boolean;
  is_popular_upcoming: boolean;
  release_date: string | null;
  release_label: string;
  release_text: string | null;
  release_precision: string;
  steam_coming_soon: boolean | null;
  released_at: string | null;
  tags: string[];
  tag_source: string;
  [key: string]: unknown;
};

type EnrichmentState = {
  steam_app_id: number;
  component: "release" | "tags" | "media";
  status: "pending" | "complete" | "partial" | "not_available" | "error";
  last_attempt_at: string | null;
  last_success_at: string | null;
  retry_after: string | null;
  consecutive_failures: number;
  source_fingerprint: string | null;
  source_payload: Record<string, unknown>;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const unauthorized = authorizeScheduledRequest(request);
  if (unauthorized) return unauthorized;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Supabase runtime is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as { limit?: unknown; appId?: unknown };
  const requestedLimit = Number(body.limit);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_BATCH_SIZE)
    : DEFAULT_BATCH_SIZE;
  const requestedAppId = Number(body.appId);
  const appId = Number.isInteger(requestedAppId) && requestedAppId > 0 ? requestedAppId : null;
  const workerId = `edge-${crypto.randomUUID()}`;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: run, error: runError } = await supabase
    .from("steam_enrichment_runs")
    .insert({ worker_id: workerId, status: "running" })
    .select("id")
    .single();
  if (runError) return Response.json({ error: "Could not start enrichment run" }, { status: 500 });

  try {
    const now = new Date();
    const refreshedAt = now.toISOString();
    const candidateRows = await selectCandidates(supabase, now, limit, appId);
    const appIds = candidateRows.map((row) => row.steam_app_id);
    const { data: existingStates, error: stateError } = appIds.length
      ? await supabase.from("steam_game_enrichment_state").select("*").in("steam_app_id", appIds)
      : { data: [], error: null };
    if (stateError) throw stateError;
    const stateByKey = new Map(
      ((existingStates ?? []) as EnrichmentState[]).map((state) => [stateKey(state.steam_app_id, state.component), state]),
    );

    const results = await mapWithConcurrency(candidateRows, DETAILS_CONCURRENCY, (row) =>
      enrichGame(row, stateByKey, refreshedAt)
    );
    const updatedRows = results.map((result) => result.row);
    const stateRows = results.flatMap((result) => result.states);
    const transitions = results.flatMap((result) => result.transition ? [result.transition] : []);

    for (let offset = 0; offset < updatedRows.length; offset += UPSERT_BATCH_SIZE) {
      const { error } = await supabase.from("steam_games").upsert(
        updatedRows.slice(offset, offset + UPSERT_BATCH_SIZE),
        { onConflict: "steam_app_id" },
      );
      if (error) throw error;
    }
    for (let offset = 0; offset < stateRows.length; offset += UPSERT_BATCH_SIZE) {
      const { error } = await supabase.from("steam_game_enrichment_state").upsert(
        stateRows.slice(offset, offset + UPSERT_BATCH_SIZE),
        { onConflict: "steam_app_id,component" },
      );
      if (error) throw error;
    }
    if (transitions.length) {
      const { error } = await supabase.from("steam_game_release_transitions").insert(transitions);
      if (error) throw error;
    }

    const succeeded = results.filter((result) => result.failedComponents === 0).length;
    const failed = results.filter((result) => result.failedComponents > 0).length;
    const partial = results.filter((result) => result.states.some((state) => state.status === "partial")).length;
    const unavailable = results.filter((result) => result.states.some((state) => state.status === "not_available")).length;
    const released = results.filter((result) => result.row.lifecycle_status === "released").length;
    const stillPending = stateRows.filter((state) => state.status === "pending").length;
    const finalStatus = failed ? (succeeded ? "partial" : "error") : "success";
    const finishedAt = new Date().toISOString();
    await supabase.from("steam_enrichment_runs").update({
      status: finalStatus,
      finished_at: finishedAt,
      selected_count: candidateRows.length,
      succeeded_count: succeeded,
      partial_count: partial,
      unavailable_count: unavailable,
      failed_count: failed,
      released_count: released,
      still_pending_count: stillPending,
    }).eq("id", run.id);

    return Response.json({
      status: finalStatus,
      runId: run.id,
      refreshedAt,
      selectedCount: candidateRows.length,
      succeededCount: succeeded,
      failedCount: failed,
      partialCount: partial,
      unavailableCount: unavailable,
      releasedCount: released,
      stillPendingCount: stillPending,
      remainingCatalogBackfill: candidateRows.length === limit,
    });
  } catch (error) {
    const message = boundedMessage(error);
    console.error("Steam details sync failed", { runId: run.id, message });
    await supabase.from("steam_enrichment_runs").update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_message: message,
    }).eq("id", run.id);
    return Response.json({ error: "Steam details sync failed", runId: run.id }, { status: 500 });
  }
});

async function selectCandidates(
  supabase: ReturnType<typeof createClient>,
  now: Date,
  limit: number,
  appId: number | null,
) {
  if (appId !== null) {
    const { data, error } = await supabase.from("steam_games").select("*")
      .eq("steam_app_id", appId).eq("is_wishlisted", true).eq("lifecycle_status", "upcoming");
    if (error) throw error;
    return (data ?? []) as SteamGameRow[];
  }

  const releaseCutoff = new Date(now.valueOf() - RELEASE_REFRESH_MS).toISOString();
  const slowCutoff = new Date(now.valueOf() - SLOW_REFRESH_MS).toISOString();
  const { data: dueStates, error: dueError } = await supabase
    .from("steam_game_enrichment_state")
    .select("steam_app_id,component,status,last_attempt_at,last_success_at,retry_after")
    .or([
      "status.in.(pending,error,partial)",
      `and(component.eq.release,last_success_at.lt.${releaseCutoff})`,
      `and(component.in.(tags,media),last_success_at.lt.${slowCutoff})`,
      "last_success_at.is.null",
    ].join(","))
    .or(`retry_after.is.null,retry_after.lte.${now.toISOString()}`)
    .order("last_attempt_at", { ascending: true, nullsFirst: true })
    .limit(Math.min(limit * 4, 800));
  if (dueError) throw dueError;
  const dueIds = [...new Set((dueStates ?? []).map((state) => Number(state.steam_app_id)))];
  if (!dueIds.length) return [];

  const { data: games, error: gamesError } = await supabase.from("steam_games").select("*")
    .eq("is_wishlisted", true).eq("lifecycle_status", "upcoming").in("steam_app_id", dueIds);
  if (gamesError) throw gamesError;
  const { data: trends } = await supabase.rpc("get_steam_bet_trends");
  const trendIds = new Set((trends ?? []).map((trend) => Number(trend.steam_app_id)));
  const soon = new Date(now.valueOf() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return ((games ?? []) as SteamGameRow[])
    .sort((left, right) => {
      const leftPriority = priority(left, trendIds, soon);
      const rightPriority = priority(right, trendIds, soon);
      return leftPriority - rightPriority
        || (left.wishlist_rank ?? Number.MAX_SAFE_INTEGER) - (right.wishlist_rank ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, limit);
}

function priority(row: SteamGameRow, trendIds: Set<number>, soon: string) {
  if (row.is_popular_upcoming) return 0;
  if (trendIds.has(row.steam_app_id)) return 1;
  if (row.release_date && row.release_date <= soon) return 2;
  return 3;
}

async function enrichGame(
  original: SteamGameRow,
  stateByKey: Map<string, EnrichmentState>,
  refreshedAt: string,
) {
  let row = { ...original, steam_data_attempted_at: refreshedAt };
  const states: EnrichmentState[] = [];
  let details: SteamAppDetails | null = null;
  let transition: Record<string, unknown> | null = null;
  let failedComponents = 0;

  try {
    details = await fetchSteamAppDetails(original.steam_app_id);
    if (details.releaseInvalid) {
      states.push(errorState(original.steam_app_id, "release", previousState(stateByKey, original.steam_app_id, "release"), refreshedAt,
        new SteamFetchError("invalid_release_date", `Invalid Steam release date: ${details.releaseText ?? "empty"}`)));
      failedComponents += 1;
      row = {
        ...applySteamAppDetails(row, details, refreshedAt),
        release_date: original.release_date,
        release_label: original.release_label,
        release_text: original.release_text,
        release_precision: original.release_precision,
        steam_coming_soon: original.steam_coming_soon,
        release_metadata_updated_at: original.release_metadata_updated_at,
      };
    } else {
      row = applySteamAppDetails(row, details, refreshedAt);
      states.push(successState(original.steam_app_id, "release", "complete", refreshedAt));
      if (releaseChanged(original, row)) {
        transition = {
          steam_app_id: original.steam_app_id,
          previous_release_date: original.release_date,
          next_release_date: row.release_date,
          previous_release_text: original.release_text,
          next_release_text: row.release_text,
          previous_precision: original.release_precision,
          next_precision: row.release_precision,
          previous_coming_soon: original.steam_coming_soon,
          next_coming_soon: row.steam_coming_soon,
          observed_at: refreshedAt,
        };
      }
    }

    const mediaPrevious = previousState(stateByKey, original.steam_app_id, "media");
    const mediaPayload = { screenshots: details.screenshots };
    const mediaFingerprint = details.screenshots.map((item) => item.sourceUrl).join("\n") || "none";
    if (!details.screenshots.length) {
      states.push(successState(original.steam_app_id, "media", "not_available", refreshedAt, mediaFingerprint, mediaPayload));
    } else if (
      mediaPrevious?.source_fingerprint === mediaFingerprint
      && ["complete", "partial"].includes(mediaPrevious.status)
    ) {
      states.push(successState(
        original.steam_app_id,
        "media",
        mediaPrevious.status,
        refreshedAt,
        mediaFingerprint,
        mediaPayload,
      ));
    } else {
      states.push(successState(original.steam_app_id, "media", "pending", refreshedAt, mediaFingerprint, mediaPayload));
    }
  } catch (error) {
    for (const component of ["release", "media"] as const) {
      states.push(errorState(original.steam_app_id, component, previousState(stateByKey, original.steam_app_id, component), refreshedAt, error));
      failedComponents += 1;
    }
  }

  try {
    const storeTags = await fetchSteamStoreTags(original.steam_app_id);
    if (storeTags.outcome === "age_gate") {
      throw new SteamFetchError("age_gate", "Steam Store page remained age-gated after mature cookie");
    }
    if (storeTags.tags.length) {
      row = { ...row, tags: storeTags.tags, tag_source: "steam_store_tags", tags_updated_at: refreshedAt };
      states.push(successState(original.steam_app_id, "tags", "complete", refreshedAt));
    } else if (details?.genreFallback.length) {
      row = { ...row, tags: details.genreFallback, tag_source: "appdetails_genres_fallback", tags_updated_at: refreshedAt };
      states.push(successState(original.steam_app_id, "tags", "partial", refreshedAt));
    } else {
      row = { ...row, tags: [], tag_source: "none", tags_updated_at: refreshedAt };
      states.push(successState(original.steam_app_id, "tags", "not_available", refreshedAt));
    }
  } catch (error) {
    states.push(errorState(original.steam_app_id, "tags", previousState(stateByKey, original.steam_app_id, "tags"), refreshedAt, error));
    failedComponents += 1;
  }

  return { row, states, transition, failedComponents };
}

function previousState(states: Map<string, EnrichmentState>, appId: number, component: EnrichmentState["component"]) {
  return states.get(stateKey(appId, component));
}

function successState(
  steamAppId: number,
  component: EnrichmentState["component"],
  status: EnrichmentState["status"],
  at: string,
  sourceFingerprint: string | null = null,
  sourcePayload: Record<string, unknown> = {},
): EnrichmentState {
  return {
    steam_app_id: steamAppId,
    component,
    status,
    last_attempt_at: at,
    last_success_at: at,
    retry_after: null,
    consecutive_failures: 0,
    error_code: null,
    error_message: null,
    source_fingerprint: sourceFingerprint,
    source_payload: sourcePayload,
    lease_owner: null,
    lease_expires_at: null,
  } as EnrichmentState;
}

function errorState(
  steamAppId: number,
  component: EnrichmentState["component"],
  previous: EnrichmentState | undefined,
  at: string,
  error: unknown,
): EnrichmentState {
  const failures = (previous?.consecutive_failures ?? 0) + 1;
  const steamError = error instanceof SteamFetchError ? error : null;
  const backoffSeconds = steamError?.retryAfterSeconds
    ?? Math.min(300 * 2 ** Math.min(failures - 1, 8), 86_400);
  const jitter = Math.floor(Math.random() * Math.max(30, backoffSeconds * 0.2));
  return {
    steam_app_id: steamAppId,
    component,
    status: "error",
    last_attempt_at: at,
    last_success_at: previous?.last_success_at ?? null,
    retry_after: new Date(Date.parse(at) + (backoffSeconds + jitter) * 1000).toISOString(),
    consecutive_failures: failures,
    error_code: steamError?.code ?? "unexpected_error",
    error_message: boundedMessage(error).slice(0, 500),
    source_fingerprint: previous?.source_fingerprint ?? null,
    source_payload: previous?.source_payload ?? {},
    lease_owner: null,
    lease_expires_at: null,
  } as EnrichmentState;
}

function releaseChanged(previous: SteamGameRow, next: SteamGameRow) {
  return previous.release_date !== next.release_date
    || previous.release_text !== next.release_text
    || previous.release_precision !== next.release_precision
    || previous.steam_coming_soon !== next.steam_coming_soon;
}

function stateKey(appId: number, component: string) {
  return `${appId}:${component}`;
}

function boundedMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 1000);
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, task: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await task(values[index]!);
    }
  }));
  return results;
}
