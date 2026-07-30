import Link from "next/link";
import { redirect } from "next/navigation";
import { ForecastFeed } from "@/components/steambets/forecast-feed";
import {
  getCurrentUserSteamBets,
  getSteamBetSummaries,
  getSteamBetTrends,
} from "@/data/steam-bets";
import { getSteamPopularUpcoming } from "@/data/steam-popular-upcoming";
import { getSteamWishlistRanks, searchSteamCatalogGames } from "@/data/steam-game-catalog";
import {
  buildSteamFeed,
  sortPopularUpcomingGames,
  type SteamFeedMode,
} from "@/lib/steam-feed";

const TITLES: Record<SteamFeedMode, string> = {
  upcoming: "Popular upcoming Steam games",
  trending: "Trending Steam games",
  involved: "Steam games you predicted",
};

export async function SteamFeedPage({
  mode,
  searchParams,
}: {
  mode: SteamFeedMode;
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const searchQuery = q.trim();
  const [liveGames, userState, summaries, trends] = await Promise.all([
    mode === "upcoming" && searchQuery
      ? searchSteamCatalogGames(searchQuery, 50)
      : getSteamPopularUpcoming(),
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
  ]);

  if (mode === "involved" && !userState.isAuthenticated) redirect("/login?next=/involved");

  const query = searchQuery.toLocaleLowerCase("en-US");
  const feed = buildSteamFeed({
    mode,
    liveGames,
    bets: userState.bets,
    summaries,
    trends,
  }).filter((game) => !query || game.name.toLocaleLowerCase("en-US").includes(query));
  const wishlistRanks = await getSteamWishlistRanks(feed.map((game) => game.appId));
  const rankedGames = feed.map((game) => ({
    ...game,
    wishlistRank: wishlistRanks.get(game.appId) ?? game.wishlistRank,
  }));
  const games = mode === "upcoming" ? sortPopularUpcomingGames(rankedGames) : rankedGames;

  return (
    <div className="sb-shell sb-page">
      {games.length ? (
        <ForecastFeed
          games={games}
          heading={TITLES[mode]}
          isAuthenticated={userState.isAuthenticated}
        />
      ) : (
        <main id="main-content" className="sb-empty">
          <h1>{query ? "No games found" : mode === "involved" ? "No bets yet" : "No games yet"}</h1>
          <Link href={mode === "involved" && !query ? "/" : mode === "upcoming" ? "/" : `/${mode}`}>
            {query ? "Clear search" : mode === "involved" ? "View upcoming games" : "Refresh"}
          </Link>
        </main>
      )}
    </div>
  );
}
