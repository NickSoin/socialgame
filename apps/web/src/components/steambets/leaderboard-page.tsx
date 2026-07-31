import Link from 'next/link';
import { GameAvatar } from '@/components/gamecast/game-avatar';
import {
  getSteamPointsLeaderboard,
  STEAM_LEADERBOARD_METRICS,
  type SteamLeaderboardMetric,
} from '@/data/steam-leaderboard';

const PAGE_SIZE = 25;
const metricLabels: Record<SteamLeaderboardMetric, string> = {
  all: 'All',
  first_weekend_ccu: 'CCU',
  first_month_reviews: 'Reviews',
  full_price_us: 'Price',
};
const points = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; page?: string }>;
}) {
  const params = await searchParams;
  const metric = STEAM_LEADERBOARD_METRICS.includes(params.metric as SteamLeaderboardMetric)
    ? params.metric as SteamLeaderboardMetric
    : 'all';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const rows = await getSteamPointsLeaderboard({
    metric,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pageRows = rows.filter((row) => row.isPageMember);
  const viewerOutsidePage = rows.find((row) => row.isCurrentUser && !row.isPageMember);
  const totalRows = rows[0]?.totalRows ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <main id="main-content" className="sb-shell sb-leaderboard-page">
      <div className="sb-leaderboard-page__heading">
        <div>
          <h1>Leaderboard</h1>
          <p>Points measure how much closer your forecast was than everyone else&apos;s.</p>
        </div>
        <nav aria-label="Leaderboard metric" className="sb-leaderboard-filters">
          {STEAM_LEADERBOARD_METRICS.map((candidate) => (
            <Link
              className={candidate === metric ? 'is-active' : undefined}
              href={`/leaderboard?metric=${candidate}`}
              key={candidate}
            >
              {metricLabels[candidate]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="sb-leaderboard-table" role="table" aria-label={`${metricLabels[metric]} leaderboard`}>
        <div className="sb-leaderboard-table__header" role="row">
          <span>Rank</span><span>Player</span><span>Points</span><span>Scored days</span><span>Markets</span>
        </div>
        {pageRows.map((row) => (
          <div className={row.isCurrentUser ? 'is-viewer' : undefined} key={row.userId} role="row">
            <strong>#{row.rank}</strong>
            <Link href={`/@${row.username}`}>
              <GameAvatar avatarId={row.avatarId} size="sm" />
              <span><b>{row.displayName}</b><small>@{row.username}</small></span>
            </Link>
            <strong>{points.format(row.points)}</strong>
            <span>{row.scoredDays}</span>
            <span>{row.resolvedMarkets}</span>
          </div>
        ))}
        {!pageRows.length && <p className="sb-leaderboard-table__empty">No scored forecasts yet.</p>}
      </div>

      {viewerOutsidePage && (
        <div className="sb-leaderboard-viewer">
          <span>Your position</span>
          <strong>#{viewerOutsidePage.rank}</strong>
          <span>{points.format(viewerOutsidePage.points)} pts</span>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="sb-pagination" aria-label="Leaderboard pages">
          {page > 1 && <Link href={`/leaderboard?metric=${metric}&page=${page - 1}`}>Previous</Link>}
          <span>Page {Math.min(page, pageCount)} of {pageCount}</span>
          {page < pageCount && <Link href={`/leaderboard?metric=${metric}&page=${page + 1}`}>Next</Link>}
        </nav>
      )}
    </main>
  );
}
