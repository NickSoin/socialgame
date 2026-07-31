import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import { authorizeScheduledRequest } from "../_shared/scheduled-auth.ts";
import { parseSteamPopularUpcoming } from "../_shared/steam-popular-upcoming.ts";

const PAGE_SIZE = 100;
const PAGE_COUNT = 2;

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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
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
    const refreshedRows = matchedEntries.map((entry) => ({
      ...catalogById.get(entry.appId)!,
      is_popular_upcoming: true,
      popular_upcoming_position: entry.position,
    }));

    const { error: upsertError } = await supabase
      .from("steam_games")
      .upsert(refreshedRows, { onConflict: "steam_app_id" });
    if (upsertError) throw upsertError;

    const activePopularIds = refreshedRows.map((row) => Number(row.steam_app_id));
    let staleQuery = supabase
      .from("steam_games")
      .update({ is_popular_upcoming: false, popular_upcoming_position: null })
      .eq("is_popular_upcoming", true);
    if (activePopularIds.length) {
      staleQuery = staleQuery.not("steam_app_id", "in", `(${activePopularIds.join(",")})`);
    }
    const { error: staleError } = await staleQuery;
    if (staleError) throw staleError;

    const popularCount = refreshedRows.length;

    return Response.json({
      status: "synced",
      refreshedAt,
      steamCount: steamEntries.length,
      topWishlistedCount: popularCount,
      releasedCount: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Steam popular upcoming sync failed", { message });
    return Response.json({ error: "Steam popular upcoming sync failed" }, { status: 500 });
  }
});

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
