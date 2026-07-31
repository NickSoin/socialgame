import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import { fetchSteamFollowerCount, SteamFetchError } from "../_shared/steam-app-details.ts";
import { authorizeScheduledRequest } from "../_shared/scheduled-auth.ts";

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 50;
const FOLLOWER_CONCURRENCY = 1;
const MIN_REQUEST_INTERVAL_MS = 750;
const REFRESH_MS = 24 * 60 * 60 * 1000;

type FollowerState = {
  steam_app_id: number;
  last_success_at: string | null;
  consecutive_failures: number;
  source_fingerprint: string | null;
  source_payload: Record<string, unknown>;
};

type GameRow = {
  steam_app_id: number;
  wishlist_rank: number | null;
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
  const workerId = `followers-${crypto.randomUUID()}`;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: run, error: runError } = await supabase
    .from("steam_enrichment_runs")
    .insert({ worker_id: workerId, status: "running" })
    .select("id")
    .single();
  if (runError) return Response.json({ error: "Could not start follower run" }, { status: 500 });

  try {
    const now = new Date();
    const refreshedAt = now.toISOString();
    const candidates = await selectCandidates(supabase, now, limit, appId);
    let rateLimited = false;
    const results = await mapWithConcurrency(candidates, FOLLOWER_CONCURRENCY, async ({ game, state }) => {
      if (rateLimited) return { ok: false, unavailable: false, deferred: true };
      try {
        const followerCount = await fetchFollowerCountAtPacedRate(game.steam_app_id);
        const status = followerCount === null ? "not_available" : "complete";
        const { error: gameError } = await supabase.from("steam_games").update({
          follower_count: followerCount,
          followers_updated_at: refreshedAt,
        }).eq("steam_app_id", game.steam_app_id);
        if (gameError) throw gameError;

        const { error: stateError } = await supabase.from("steam_game_enrichment_state").upsert({
          steam_app_id: game.steam_app_id,
          component: "followers",
          status,
          last_attempt_at: refreshedAt,
          last_success_at: refreshedAt,
          retry_after: null,
          consecutive_failures: 0,
          error_code: null,
          error_message: null,
          source_fingerprint: followerCount === null ? "none" : String(followerCount),
          source_payload: followerCount === null ? {} : { followerCount },
          lease_owner: null,
          lease_expires_at: null,
        }, { onConflict: "steam_app_id,component" });
        if (stateError) throw stateError;
        return { ok: true, unavailable: followerCount === null, deferred: false };
      } catch (error) {
        const failures = (state.consecutive_failures ?? 0) + 1;
        const steamError = error instanceof SteamFetchError ? error : null;
        if (steamError?.code === "rate_limited") rateLimited = true;
        const backoffSeconds = steamError?.retryAfterSeconds
          ?? Math.min(300 * 2 ** Math.min(failures - 1, 8), 86_400);
        const jitter = Math.floor(Math.random() * Math.max(30, backoffSeconds * 0.2));
        const { error: stateError } = await supabase.from("steam_game_enrichment_state").upsert({
          steam_app_id: game.steam_app_id,
          component: "followers",
          status: "error",
          last_attempt_at: refreshedAt,
          last_success_at: state.last_success_at,
          retry_after: new Date(now.valueOf() + (backoffSeconds + jitter) * 1000).toISOString(),
          consecutive_failures: failures,
          error_code: steamError?.code ?? "unexpected_error",
          error_message: boundedMessage(error).slice(0, 500),
          source_fingerprint: state.source_fingerprint,
          source_payload: state.source_payload,
          lease_owner: null,
          lease_expires_at: null,
        }, { onConflict: "steam_app_id,component" });
        if (stateError) throw stateError;
        return { ok: false, unavailable: false, deferred: false };
      }
    });

    const succeeded = results.filter((result) => result.ok).length;
    const failed = results.filter((result) => !result.ok && !result.deferred).length;
    const deferred = results.filter((result) => result.deferred).length;
    const unavailable = results.filter((result) => result.unavailable).length;
    const status = failed ? (succeeded ? "partial" : "error") : "success";
    const { count: remaining } = await supabase.from("steam_game_enrichment_state")
      .select("*", { count: "exact", head: true })
      .eq("component", "followers")
      .in("status", ["pending", "error", "partial"]);

    await supabase.from("steam_enrichment_runs").update({
      status,
      finished_at: new Date().toISOString(),
      selected_count: candidates.length,
      succeeded_count: succeeded,
      unavailable_count: unavailable,
      failed_count: failed,
      still_pending_count: remaining ?? 0,
    }).eq("id", run.id);

    return Response.json({
      status,
      runId: run.id,
      selectedCount: candidates.length,
      succeededCount: succeeded,
      unavailableCount: unavailable,
      failedCount: failed,
      deferredCount: deferred,
      stillPendingCount: remaining ?? 0,
    });
  } catch (error) {
    const message = boundedMessage(error);
    await supabase.from("steam_enrichment_runs").update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_message: message,
    }).eq("id", run.id);
    return Response.json({ error: "Steam follower sync failed", runId: run.id }, { status: 500 });
  }
});

async function selectCandidates(
  supabase: ReturnType<typeof createClient>,
  now: Date,
  limit: number,
  appId: number | null,
) {
  let statesQuery = supabase.from("steam_game_enrichment_state").select(
    "steam_app_id,last_success_at,consecutive_failures,source_fingerprint,source_payload",
  ).eq("component", "followers");

  if (appId !== null) {
    statesQuery = statesQuery.eq("steam_app_id", appId);
  } else {
    const cutoff = new Date(now.valueOf() - REFRESH_MS).toISOString();
    statesQuery = statesQuery
      .or(`status.in.(pending,error,partial),last_success_at.is.null,last_success_at.lt.${cutoff}`)
      .or(`retry_after.is.null,retry_after.lte.${now.toISOString()}`)
      .order("last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(Math.min(limit * 4, 800));
  }

  const { data: states, error: statesError } = await statesQuery;
  if (statesError) throw statesError;
  const stateRows = (states ?? []) as FollowerState[];
  if (!stateRows.length) return [];

  const stateByAppId = new Map(stateRows.map((state) => [Number(state.steam_app_id), state]));
  const { data: games, error: gamesError } = await supabase.from("steam_games")
    .select("steam_app_id,wishlist_rank")
    .eq("is_wishlisted", true)
    .eq("lifecycle_status", "upcoming")
    .in("steam_app_id", [...stateByAppId.keys()]);
  if (gamesError) throw gamesError;

  return ((games ?? []) as GameRow[])
    .sort((left, right) =>
      (left.wishlist_rank ?? Number.MAX_SAFE_INTEGER) - (right.wishlist_rank ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, limit)
    .map((game) => ({ game, state: stateByAppId.get(game.steam_app_id)! }));
}

function boundedMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 1000);
}

async function fetchFollowerCountAtPacedRate(appId: number) {
  const startedAt = Date.now();
  try {
    return await fetchSteamFollowerCount(appId);
  } finally {
    const remainingDelay = MIN_REQUEST_INTERVAL_MS - (Date.now() - startedAt);
    if (remainingDelay > 0) await delay(remainingDelay);
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
