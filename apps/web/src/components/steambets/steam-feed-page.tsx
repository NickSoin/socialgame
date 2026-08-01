import Link from "next/link";
import { redirect } from "next/navigation";
import { InfiniteForecastFeed } from "@/components/steambets/infinite-forecast-feed";
import { getSteamFeedPageData } from "@/data/steam-feed-page";
import { getSteamPointsLeaderboard } from "@/data/steam-leaderboard";
import type { SteamFeedMode } from "@/lib/steam-feed";
import { buildSteamFeedHref } from "@/lib/steam-feed-pagination";
import { PointsLeaderboard } from "./points-leaderboard";

const TITLES: Record<SteamFeedMode, string> = {
  upcoming: "Popular upcoming Steam games",
  trending: "Trending Steam games",
  locked: "Locked Steam games",
  completed: "Completed Steam games",
  involved: "My forecasts",
};

export async function SteamFeedPage({
  mode,
  searchParams,
}: {
  mode: SteamFeedMode;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status: statusParam = "open" } = await searchParams;
  const status = statusParam === "resolved" ? "resolved" : "open";
  const searchQuery = q.trim();
  const [feedPage, leaderboard] = await Promise.all([
    getSteamFeedPageData({ mode, page: 1, query: searchQuery, status }),
    getSteamPointsLeaderboard({ limit: 7 }).catch((error: unknown) => {
      console.error("Could not load points leaderboard.", error);
      return [];
    }),
  ]);

  if (mode === "involved" && !feedPage.isAuthenticated) redirect("/login?next=/involved");

  return (
    <div className="sb-shell sb-page">
      <div className="sb-page-grid">
        <div className="sb-feed-column">
          {mode === "involved" && (
            <nav className="sb-forecast-status-tabs" aria-label="Forecast status">
              <Link
                className={status !== "resolved" ? "is-active" : undefined}
                href={buildSteamFeedHref({ mode, query: searchQuery, status: "open" })}
              >
                Open
              </Link>
              <Link
                className={status === "resolved" ? "is-active" : undefined}
                href={buildSteamFeedHref({ mode, query: searchQuery, status: "resolved" })}
              >
                Resolved
              </Link>
            </nav>
          )}
          {feedPage.games.length ? (
            <InfiniteForecastFeed
              games={feedPage.games}
              hasMore={feedPage.hasMore}
              heading={TITLES[mode]}
              isAuthenticated={feedPage.isAuthenticated}
              key={`${mode}:${searchQuery}:${status}`}
              mode={mode}
              query={searchQuery}
              status={status}
            />
          ) : (
            <main id="main-content" className="sb-empty">
              <h1>{searchQuery
                ? "No games found"
                : mode === "involved"
                  ? "No forecasts here"
                  : mode === "locked"
                    ? "No locked games yet"
                  : mode === "completed"
                    ? "No completed games yet"
                    : "No games yet"}</h1>
              <Link href={searchQuery
                ? buildSteamFeedHref({ mode, status })
                : mode === "involved"
                  ? "/"
                  : buildSteamFeedHref({ mode, status })}>
                {searchQuery ? "Clear search" : mode === "involved" ? "View upcoming games" : "Refresh"}
              </Link>
            </main>
          )}
        </div>
        <PointsLeaderboard rows={leaderboard} />
      </div>
    </div>
  );
}
