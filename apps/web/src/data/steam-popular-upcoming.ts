import { cacheLife, cacheTag } from "next/cache";
import "server-only";
import type { SteamUpcomingGame } from "@/lib/steam-bets";
import { parseSteamPopularUpcoming } from "@/lib/parse-steam-popular-upcoming";
import { getOpenSteamCatalogGame } from "@/data/steam-game-catalog";

const STEAM_POPULAR_UPCOMING_PAGE_SIZE = 100;
const STEAM_POPULAR_UPCOMING_PAGE_COUNT = 2;

function steamPopularUpcomingUrl(start: number) {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("query", "");
  url.searchParams.set("start", String(start));
  url.searchParams.set("count", String(STEAM_POPULAR_UPCOMING_PAGE_SIZE));
  url.searchParams.set("dynamic_data", "");
  url.searchParams.set("sort_by", "_ASC");
  url.searchParams.set("filter", "popularcomingsoon");
  url.searchParams.set("snr", "1_7_7_popularcomingsoon_7");
  url.searchParams.set("infinite", "1");
  url.searchParams.set("l", "english");
  url.searchParams.set("cc", "us");
  return url;
}

export async function getSteamPopularUpcoming(): Promise<SteamUpcomingGame[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("steam-popular-upcoming");

  return fetchSteamPopularUpcoming();
}

export async function getOpenSteamGameByAppId(
  steamAppId: number,
): Promise<SteamUpcomingGame | null> {
  const catalogResult = await getOpenSteamCatalogGame(steamAppId);
  if (catalogResult.game) return catalogResult.game;

  const fallbackGames = await fetchSteamPopularUpcoming();
  return fallbackGames.find((game) => game.appId === steamAppId) ?? null;
}

async function fetchSteamPopularUpcoming(): Promise<SteamUpcomingGame[]> {
  const proxyResultsHtml = await fetchSteamPopularUpcomingProxy();
  const pages =
    proxyResultsHtml === null
      ? await Promise.all(
          Array.from({ length: STEAM_POPULAR_UPCOMING_PAGE_COUNT }, async (_, pageIndex) => {
            const response = await fetch(
              steamPopularUpcomingUrl(pageIndex * STEAM_POPULAR_UPCOMING_PAGE_SIZE),
              {
                headers: {
                  Accept: "application/json",
                  "Accept-Language": "en-US,en;q=0.9",
                  "User-Agent": "NextHitMarket/1.0 (+https://nexthitmarket.com)",
                },
              },
            );

            if (!response.ok) throw new Error(`Steam returned ${response.status}`);
            return (await response.json()) as { results_html?: string };
          }),
        )
      : [{ results_html: proxyResultsHtml }];

  const gamesById = new Map<number, SteamUpcomingGame>();
  for (const page of pages) {
    for (const game of parseSteamPopularUpcoming(page.results_html ?? "")) {
      gamesById.set(game.appId, game);
    }
  }
  const games = [...gamesById.values()];
  if (!games.length) throw new Error("Steam returned no popular upcoming games");
  return games;
}

async function fetchSteamPopularUpcomingProxy() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const proxyUrl = new URL("/functions/v1/steam-popular-upcoming", supabaseUrl);
    if (!proxyUrl.hostname.endsWith(".supabase.co")) return null;

    const response = await fetch(proxyUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { results_html?: string };
    return payload.results_html || null;
  } catch {
    return null;
  }
}
