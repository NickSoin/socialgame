import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import { authorizeScheduledRequest } from "../_shared/scheduled-auth.ts";
import {
  fetchSteamCurrentPlayerCount,
  fetchSteamResolutionValue,
  SteamResolutionSourceError,
  type SteamResolutionMetric,
} from "../_shared/steam-market-resolution.ts";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 25;

type ResolutionQueueRow = {
  market_id: string;
  steam_app_id: number;
  game_name: string;
  metric_type: SteamResolutionMetric;
  resolve_after: string;
  status: "locked";
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

  const body = await request.json().catch(() => ({})) as { limit?: unknown };
  const requestedLimit = Number(body.limit);
  const limit = Number.isSafeInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const observationSummary = await captureLockedCcuObservations(supabase);

  const { error: cycleError } = await supabase.rpc("process_steam_market_cycle");
  if (cycleError) {
    return Response.json({ error: `Could not update market locks: ${cycleError.message}` }, { status: 500 });
  }
  const { data: queueData, error: queueError } = await supabase.rpc("get_steam_resolution_queue");
  if (queueError) {
    return Response.json({ error: `Could not load resolution queue: ${queueError.message}` }, { status: 500 });
  }

  const queue = ((queueData ?? []) as ResolutionQueueRow[]).slice(0, limit);
  const attemptCounts = new Map<string, number>();
  if (queue.length) {
    const { data, error } = await supabase
      .from("steam_forecast_markets")
      .select("id,resolution_attempt_count")
      .in("id", queue.map((market) => market.market_id));
    if (error) {
      return Response.json({ error: `Could not load retry state: ${error.message}` }, { status: 500 });
    }
    for (const row of data ?? []) attemptCounts.set(row.id, row.resolution_attempt_count);
  }

  const results: Array<Record<string, unknown>> = [];
  for (const market of queue) {
    try {
      const resolution = await resolutionValueForMarket(supabase, market);
      const resolvedAt = new Date().toISOString();
      const { error } = await supabase.rpc("resolve_steam_forecast_market", {
        p_market_id: market.market_id,
        p_actual_raw_value: resolution.value,
        p_source_reference: resolution.sourceReference,
        p_resolved_at: resolvedAt,
        p_correction_note: null,
      });
      if (error) throw error;
      results.push({
        marketId: market.market_id,
        appId: market.steam_app_id,
        metric: market.metric_type,
        status: "resolved",
        value: resolution.value,
        source: resolution.sourceReference,
      });
    } catch (error) {
      const attemptCount = attemptCounts.get(market.market_id) ?? 0;
      const retryAfter = retryDelaySeconds(error, attemptCount);
      const nextRetryAt = new Date(Date.now() + retryAfter * 1000).toISOString();
      const message = error instanceof Error ? error.message : String(error);
      const { error: recordError } = await supabase.rpc("record_steam_market_resolution_failure", {
        p_market_id: market.market_id,
        p_error: message,
        p_next_retry_at: nextRetryAt,
      });
      results.push({
        marketId: market.market_id,
        appId: market.steam_app_id,
        metric: market.metric_type,
        status: "retry",
        error: message,
        nextRetryAt,
        retryStateSaved: !recordError,
      });
    }
  }

  return Response.json({
    processedAt: new Date().toISOString(),
    queued: (queueData ?? []).length,
    processed: queue.length,
    resolved: results.filter((result) => result.status === "resolved").length,
    retrying: results.filter((result) => result.status === "retry").length,
    ccuObservations: observationSummary,
    results,
  });
});

async function resolutionValueForMarket(
  supabase: ReturnType<typeof createClient>,
  market: ResolutionQueueRow,
) {
  try {
    return await fetchSteamResolutionValue(market.metric_type, Number(market.steam_app_id));
  } catch (error) {
    if (market.metric_type !== "first_weekend_ccu") throw error;
    const [{ data: observations, error: observationError }, { data: marketData, error: marketError }] = await Promise.all([
      supabase
      .from("steam_ccu_observations")
      .select("player_count,observed_at,source_reference")
      .eq("market_id", market.market_id)
      .order("observed_at", { ascending: true })
      .limit(1_000),
      supabase
        .from("steam_forecast_markets")
        .select("resolve_after,steam_games!inner(released_at)")
        .eq("id", market.market_id)
        .single(),
    ]);
    if (observationError) throw observationError;
    if (marketError) throw marketError;
    const game = Array.isArray(marketData.steam_games)
      ? marketData.steam_games[0]
      : marketData.steam_games;
    const releasedAt = Date.parse(game?.released_at ?? "");
    const resolveAfter = Date.parse(marketData.resolve_after ?? market.resolve_after);
    const firstObservedAt = Date.parse(observations?.[0]?.observed_at ?? "");
    const lastObservedAt = Date.parse(observations?.at(-1)?.observed_at ?? "");
    const expectedSamples = Math.max(
      1,
      Math.floor((resolveAfter - firstObservedAt) / 300_000) + 1,
    );
    const hasCompleteCoverage = Number.isFinite(releasedAt)
      && Number.isFinite(resolveAfter)
      && Number.isFinite(firstObservedAt)
      && Number.isFinite(lastObservedAt)
      && firstObservedAt <= releasedAt + 30 * 60 * 1000
      && lastObservedAt >= resolveAfter - 15 * 60 * 1000
      && (observations?.length ?? 0) >= Math.ceil(expectedSamples * 0.7);
    if (!hasCompleteCoverage || !observations?.length) throw error;
    const peak = observations.reduce((current, observation) =>
      observation.player_count > current.player_count ? observation : current
    );
    return {
      value: Number(peak.player_count),
      sourceReference: `${peak.source_reference}#observed-first-weekend-peak;samples=${observations.length};peak-at=${encodeURIComponent(peak.observed_at)}`,
    };
  }
}

async function captureLockedCcuObservations(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const observedAt = new Date(Math.floor(now.valueOf() / 300_000) * 300_000).toISOString();
  const { data, error } = await supabase
    .from("steam_forecast_markets")
    .select("id,steam_app_id,resolve_after,steam_games!inner(lifecycle_status)")
    .eq("status", "locked")
    .eq("metric_type", "first_weekend_ccu")
    .eq("steam_games.lifecycle_status", "released")
    .gt("resolve_after", now.toISOString())
    .order("resolve_after", { ascending: true })
    .limit(200);
  if (error) return { selected: 0, saved: 0, failed: 1, error: error.message };

  const results = await mapWithConcurrency(data ?? [], 6, async (market) => {
    try {
      const observation = await fetchSteamCurrentPlayerCount(Number(market.steam_app_id));
      const { error: insertError } = await supabase.from("steam_ccu_observations").upsert({
        market_id: market.id,
        observed_at: observedAt,
        player_count: observation.value,
        source_reference: observation.sourceReference,
      }, { onConflict: "market_id,observed_at" });
      if (insertError) throw insertError;
      return true;
    } catch {
      return false;
    }
  });
  return {
    selected: results.length,
    saved: results.filter(Boolean).length,
    failed: results.filter((saved) => !saved).length,
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

function retryDelaySeconds(error: unknown, attemptCount: number) {
  if (error instanceof SteamResolutionSourceError && error.retryAfterSeconds !== null) {
    return Math.max(error.retryAfterSeconds, 15 * 60);
  }
  return Math.min(15 * 60 * 2 ** Math.min(attemptCount, 7), 24 * 60 * 60);
}
