import "server-only";
import {
  getCurrentUserSteamBets,
  getSteamBetSummaries,
  getSteamBetTrends,
  getSteamPredictionStates,
} from "@/data/steam-bets";
import {
  getSteamCompletedGamesPage,
  getSteamCatalogGamesByIds,
  searchSteamCatalogGamesPage,
} from "@/data/steam-game-catalog";
import { getSteamPopularUpcoming } from "@/data/steam-popular-upcoming";
import { buildSteamFeed, type SteamFeedMode } from "@/lib/steam-feed";
import {
  getSteamFeedPageCount,
  paginateSteamFeed,
  STEAM_FEED_PAGE_SIZE,
} from "@/lib/steam-feed-pagination";

export async function getSteamFeedPageData({
  mode,
  page,
  query = "",
  status = "open",
}: {
  mode: SteamFeedMode;
  page: number;
  query?: string;
  status?: string;
}) {
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * STEAM_FEED_PAGE_SIZE;
  const searchQuery = query.trim();
  const catalogPagePromise = mode === "upcoming"
    ? searchQuery
      ? searchSteamCatalogGamesPage(searchQuery, {
          limit: STEAM_FEED_PAGE_SIZE,
          offset,
        })
      : getSteamPopularUpcoming({ limit: STEAM_FEED_PAGE_SIZE, offset })
    : mode === "completed"
      ? getSteamCompletedGamesPage(searchQuery, {
          limit: STEAM_FEED_PAGE_SIZE,
          offset,
        })
      : Promise.resolve(null);

  const [userState, summaries, trends, catalogPage] = await Promise.all([
    getCurrentUserSteamBets(),
    getSteamBetSummaries().catch((error: unknown) => {
      console.error("Could not load Steam bet summaries.", error);
      return [];
    }),
    mode === "trending"
      ? getSteamBetTrends().catch((error: unknown) => {
          console.error("Could not load trending Steam games.", error);
          return [];
        })
      : Promise.resolve([]),
    catalogPagePromise,
  ]);

  const liveGames = catalogPage?.games ?? await getSteamCatalogGamesByIds(
    mode === "trending"
      ? trends.map((trend) => trend.steam_app_id)
      : userState.bets.map((bet) => bet.steam_app_id),
  );
  const predictionStates = await getSteamPredictionStates(liveGames.map((game) => game.appId)).catch(
    (error: unknown) => {
      console.error("Could not load forecast states.", error);
      return [];
    },
  );
  const normalizedQuery = searchQuery.toLocaleLowerCase("en-US");
  const feed = buildSteamFeed({
    mode,
    liveGames,
    bets: userState.bets,
    summaries,
    trends,
    states: predictionStates,
  }).filter((game) => !normalizedQuery
    || game.name.toLocaleLowerCase("en-US").includes(normalizedQuery));
  const filteredGames = mode === "involved"
    ? feed.filter((game) => status === "resolved"
      ? game.targets.some((target) => target.marketStatus === "resolved")
      : game.targets.some((target) => target.marketStatus !== "resolved"
        && target.marketStatus !== "void"))
    : feed;
  const totalGames = catalogPage?.total ?? filteredGames.length;
  const pageCount = getSteamFeedPageCount(totalGames);
  const games = mode === "upcoming" || mode === "completed"
    ? filteredGames
    : paginateSteamFeed(filteredGames, safePage);

  return {
    games,
    hasMore: safePage < pageCount,
    isAuthenticated: userState.isAuthenticated,
  };
}
