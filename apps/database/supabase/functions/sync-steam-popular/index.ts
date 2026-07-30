import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import {
  formatSteamReleaseLabel,
  normalizeSteamReleaseDate,
} from "../_shared/steam-release-date.ts";
import { parseSteamPopularUpcoming } from "../_shared/steam-popular-upcoming.ts";

const PAGE_SIZE = 100;
const PAGE_COUNT = 2;
const DETAILS_CONCURRENCY = 8;
const MIN_REFRESH_INTERVAL_MS = 90 * 60 * 1000;

function steamPopularUpcomingUrl(start: number) {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("query", "");
  url.searchParams.set("start", String(start));
  url.searchParams.set("count", String(PAGE_SIZE));
  url.searchParams.set("dynamic_data", "");
  url.searchParams.set("sort_by", "_ASC");
  url.searchParams.set("filter", "popularcomingsoon");
  url.searchParams.set("snr", "1_7_7_popularcomingsoon_7");
  url.searchParams.set("infinite", "1");
  url.searchParams.set("l", "english");
  url.searchParams.set("cc", "us");
  return url;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Supabase runtime is not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: latestRefresh, error: latestRefreshError } = await supabase
      .from("steam_games")
      .select("steam_data_updated_at")
      .not("steam_data_updated_at", "is", null)
      .order("steam_data_updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestRefreshError) throw latestRefreshError;

    const latestRefreshAt = latestRefresh?.steam_data_updated_at
      ? new Date(latestRefresh.steam_data_updated_at).valueOf()
      : 0;
    if (Date.now() - latestRefreshAt < MIN_REFRESH_INTERVAL_MS) {
      return Response.json({ status: "fresh", refreshedAt: latestRefresh?.steam_data_updated_at });
    }

    const pages = await Promise.all(
      Array.from({ length: PAGE_COUNT }, (_, pageIndex) =>
        fetchJsonWithRetry<{ results_html?: string }>(
          steamPopularUpcomingUrl(pageIndex * PAGE_SIZE).toString(),
        )
      ),
    );
    const steamEntries = parseSteamPopularUpcoming(
      pages.map((page) => page.results_html ?? "").join(""),
    );
    if (steamEntries.length < PAGE_SIZE) {
      throw new Error(`Steam popular upcoming feed is incomplete (${steamEntries.length} rows)`);
    }

    const { data: catalogRows, error: catalogError } = await supabase
      .from("steam_games")
      .select("*")
      .eq("lifecycle_status", "upcoming")
      .eq("is_wishlisted", true)
      .in("steam_app_id", steamEntries.map((entry) => entry.appId));
    if (catalogError) throw catalogError;

    const catalogById = new Map(
      (catalogRows ?? []).map((row) => [Number(row.steam_app_id), row] as const),
    );
    const matchedEntries = steamEntries.filter((entry) => catalogById.has(entry.appId));
    if (!matchedEntries.length) {
      throw new Error("Steam popular upcoming has no TopWishlisted matches");
    }

    const refreshedAt = new Date().toISOString();
    const refreshedRows = await mapWithConcurrency(
      matchedEntries,
      DETAILS_CONCURRENCY,
      async (entry) => {
        const catalogRow = catalogById.get(entry.appId)!;
        const details = await fetchSteamAppReleaseDate(entry.appId);
        const releaseDate = details.fetched
          ? details.releaseDate
          : normalizeSteamReleaseDate(entry.releaseText);
        const released = details.fetched && details.released;
        return {
          ...catalogRow,
          lifecycle_status: released ? "released" : "upcoming",
          wishlist_rank: released ? null : catalogRow.wishlist_rank,
          wishlist_estimate: released ? null : catalogRow.wishlist_estimate,
          is_wishlisted: released ? false : true,
          is_popular_upcoming: !released,
          popular_upcoming_position: released ? null : entry.position,
          release_date: releaseDate,
          release_label: formatSteamReleaseLabel(releaseDate),
          released_at: released
            ? releaseDate
              ? `${releaseDate}T00:00:00.000Z`
              : refreshedAt
            : null,
          steam_data_updated_at: refreshedAt,
        };
      },
    );

    const { error: upsertError } = await supabase
      .from("steam_games")
      .upsert(refreshedRows, { onConflict: "steam_app_id" });
    if (upsertError) throw upsertError;

    const { error: staleError } = await supabase
      .from("steam_games")
      .update({ is_popular_upcoming: false, popular_upcoming_position: null })
      .eq("is_popular_upcoming", true)
      .lt("steam_data_updated_at", refreshedAt);
    if (staleError) throw staleError;

    const popularCount = refreshedRows.filter((row) => row.is_popular_upcoming).length;

    return Response.json({
      status: "synced",
      refreshedAt,
      steamCount: steamEntries.length,
      topWishlistedCount: popularCount,
      releasedCount: refreshedRows.length - popularCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Steam popular upcoming sync failed", { message });
    return Response.json({ error: "Steam popular upcoming sync failed" }, { status: 500 });
  }
});

async function fetchSteamAppReleaseDate(appId: number) {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "english");

  try {
    const payload = await fetchJsonWithRetry<Record<string, {
      success?: boolean;
      data?: { release_date?: { coming_soon?: unknown; date?: unknown } };
    }>>(url.toString(), 2);
    const app = payload[String(appId)];
    if (!app?.success || !app.data) {
      return { fetched: false, releaseDate: null, released: false };
    }
    return {
      fetched: true,
      releaseDate: normalizeSteamReleaseDate(app.data.release_date?.date),
      released: app.data.release_date?.coming_soon === false,
    };
  } catch (error) {
    console.warn(`Could not refresh Steam release date for app ${appId}`, error);
    return { fetched: false, releaseDate: null, released: false };
  }
}

async function fetchJsonWithRetry<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "NextHitMarket/1.0 (+https://nexthitmarket.com)",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

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
