import Link from "next/link";
import { redirect } from "next/navigation";
import { ForecastFeed } from "@/components/steambets/forecast-feed";
import {
  getCurrentUserSteamBets,
  getSteamBetSummaries,
  getSteamBetTrends,
  getSteamPredictionStates,
} from "@/data/steam-bets";
import { getSteamPointsLeaderboard } from "@/data/steam-leaderboard";
import { getSteamPopularUpcoming } from "@/data/steam-popular-upcoming";
import { getSteamCatalogGamesByIds, searchSteamCatalogGames } from "@/data/steam-game-catalog";
import { buildSteamFeed, type SteamFeedMode } from "@/lib/steam-feed";
import { PointsLeaderboard } from "./points-leaderboard";

const TITLES: Record<SteamFeedMode, string> = {
  upcoming: "Popular upcoming Steam games",
  trending: "Trending Steam games",
  involved: "My forecasts",
};

export async function SteamFeedPage({
  mode,
  searchParams,
}: {
  mode: SteamFeedMode;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "open" } = await searchParams;
  const searchQuery = q.trim();
  const [userState, summaries, trends, leaderboard] = await Promise.all([
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
    getSteamPointsLeaderboard({ limit: 7 }).catch((error: unknown) => {
      console.error("Could not load points leaderboard.", error);
      return [];
    }),
  ]);

  if (mode === "involved" && !userState.isAuthenticated) redirect("/login?next=/involved");

  const liveGames =
    mode === "upcoming"
      ? searchQuery
        ? await searchSteamCatalogGames(searchQuery, 50)
        : await getSteamPopularUpcoming()
      : await getSteamCatalogGamesByIds(
          mode === "trending"
            ? trends.map((trend) => trend.steam_app_id)
            : userState.bets.map((bet) => bet.steam_app_id),
        );

  const query = searchQuery.toLocaleLowerCase("en-US");
  const predictionStates = await getSteamPredictionStates(liveGames.map((game) => game.appId)).catch(
    (error: unknown) => {
      console.error("Could not load forecast states.", error);
      return [];
    },
  );
  const feed = buildSteamFeed({
    mode,
    liveGames,
    bets: userState.bets,
    summaries,
    trends,
    states: predictionStates,
  }).filter((game) => !query || game.name.toLocaleLowerCase("en-US").includes(query));
  const games = mode === "involved"
    ? feed.filter((game) => status === "resolved"
      ? game.targets.some((target) => target.marketStatus === "resolved")
      : game.targets.some((target) => target.marketStatus !== "resolved" && target.marketStatus !== "void"))
    : feed;

  return (
    <div className="sb-shell sb-page">
      <div className="sb-page-grid">
        <div className="sb-feed-column">
          {mode === "involved" && (
            <nav className="sb-forecast-status-tabs" aria-label="Forecast status">
              <Link className={status !== "resolved" ? "is-active" : undefined} href="/involved?status=open">Open</Link>
              <Link className={status === "resolved" ? "is-active" : undefined} href="/involved?status=resolved">Resolved</Link>
            </nav>
          )}
          {games.length ? (
            <ForecastFeed
              games={games}
              heading={TITLES[mode]}
              isAuthenticated={userState.isAuthenticated}
            />
          ) : (
            <main id="main-content" className="sb-empty">
              <h1>{query ? "No games found" : mode === "involved" ? "No forecasts here" : "No games yet"}</h1>
              <Link href={mode === "involved" && !query ? "/" : mode === "upcoming" ? "/" : `/${mode}`}>
                {query ? "Clear search" : mode === "involved" ? "View upcoming games" : "Refresh"}
              </Link>
            </main>
          )}
        </div>
        <PointsLeaderboard rows={leaderboard} />
      </div>
    </div>
  );
}
