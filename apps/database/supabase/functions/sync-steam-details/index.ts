import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import {
  applySteamAppDetails,
  fetchSteamAppDetails,
} from "../_shared/steam-app-details.ts";

const DEFAULT_BATCH_SIZE = 180;
const MAX_BATCH_SIZE = 200;
const DETAILS_CONCURRENCY = 6;
const UPSERT_BATCH_SIZE = 100;
const PRIORITY_REFRESH_MS = 90 * 60 * 1000;
const CATALOG_REFRESH_MS = 30 * 60 * 60 * 1000;

type SteamGameRow = {
  steam_app_id: number;
  lifecycle_status: string;
  wishlist_rank: number | null;
  wishlist_estimate: string | null;
  is_wishlisted: boolean;
  released_at: string | null;
  [key: string]: unknown;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Supabase runtime is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as { limit?: unknown };
  const requestedLimit = Number(body.limit);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_BATCH_SIZE)
    : DEFAULT_BATCH_SIZE;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const now = new Date();
    const refreshedAt = now.toISOString();
    const priorityCutoff = new Date(now.valueOf() - PRIORITY_REFRESH_MS).toISOString();
    const catalogCutoff = new Date(now.valueOf() - CATALOG_REFRESH_MS).toISOString();
    const candidates = new Map<number, SteamGameRow>();

    const addCandidates = (rows: unknown[] | null) => {
      for (const row of (rows ?? []) as SteamGameRow[]) {
        if (candidates.size >= limit) break;
        candidates.set(Number(row.steam_app_id), row);
      }
    };

    const { data: popularRows, error: popularError } = await supabase
      .from("steam_games")
      .select("*")
      .eq("lifecycle_status", "upcoming")
      .eq("is_wishlisted", true)
      .eq("is_popular_upcoming", true)
      .or(`steam_data_attempted_at.is.null,steam_data_attempted_at.lt.${priorityCutoff}`)
      .order("wishlist_rank", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (popularError) throw popularError;
    addCandidates(popularRows);

    const { data: trends, error: trendsError } = await supabase.rpc("get_steam_bet_trends");
    if (trendsError) throw trendsError;
    const trendIds = (trends ?? [])
      .map((trend) => Number(trend.steam_app_id))
      .filter((appId) => Number.isInteger(appId) && appId > 0);
    if (trendIds.length && candidates.size < limit) {
      const { data: trendRows, error: trendRowsError } = await supabase
        .from("steam_games")
        .select("*")
        .eq("lifecycle_status", "upcoming")
        .eq("is_wishlisted", true)
        .in("steam_app_id", trendIds)
        .or(`steam_data_attempted_at.is.null,steam_data_attempted_at.lt.${priorityCutoff}`)
        .limit(limit - candidates.size);
      if (trendRowsError) throw trendRowsError;
      addCandidates(trendRows);
    }

    if (candidates.size < limit) {
      const { data: catalogRows, error: catalogError } = await supabase
        .from("steam_games")
        .select("*")
        .eq("lifecycle_status", "upcoming")
        .eq("is_wishlisted", true)
        .or(`steam_data_attempted_at.is.null,steam_data_attempted_at.lt.${catalogCutoff}`)
        .order("steam_data_attempted_at", { ascending: true, nullsFirst: true })
        .order("wishlist_rank", { ascending: true, nullsFirst: false })
        .limit(limit);
      if (catalogError) throw catalogError;
      addCandidates(catalogRows);
    }

    const candidateRows = [...candidates.values()].slice(0, limit);
    const detailResults = await mapWithConcurrency(
      candidateRows,
      DETAILS_CONCURRENCY,
      async (row) => ({ row, details: await fetchSteamAppDetails(row.steam_app_id) }),
    );
    const updatedRows = detailResults.flatMap(({ row, details }) =>
      details ? [applySteamAppDetails(row, details, refreshedAt)] : []
    );
    const failedRows = detailResults.flatMap(({ row, details }) =>
      details ? [] : [{ ...row, steam_data_attempted_at: refreshedAt }]
    );
    const attemptedRows = [...updatedRows, ...failedRows];

    for (let offset = 0; offset < attemptedRows.length; offset += UPSERT_BATCH_SIZE) {
      const { error } = await supabase
        .from("steam_games")
        .upsert(attemptedRows.slice(offset, offset + UPSERT_BATCH_SIZE), {
          onConflict: "steam_app_id",
        });
      if (error) throw error;
    }

    return Response.json({
      status: "synced",
      refreshedAt,
      selectedCount: candidateRows.length,
      attemptedCount: attemptedRows.length,
      updatedCount: updatedRows.length,
      failedCount: candidateRows.length - updatedRows.length,
      releasedCount: updatedRows.filter((row) => row.lifecycle_status === "released").length,
      remainingCatalogBackfill: candidateRows.length === limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Steam details sync failed", { message });
    return Response.json({ error: "Steam details sync failed" }, { status: 500 });
  }
});

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await task(values[index]!);
      }
    }),
  );

  return results;
}
