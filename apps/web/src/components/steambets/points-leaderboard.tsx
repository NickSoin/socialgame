import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import type { SteamLeaderboardRow } from '@/data/steam-leaderboard';

const points = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function PointsLeaderboard({ rows }: { rows: SteamLeaderboardRow[] }) {
  const visibleRows = rows.filter((row) => row.isPageMember).slice(0, 7);

  return (
    <aside className="sb-leaderboard-card" aria-labelledby="points-leaderboard-title">
      <Link className="sb-leaderboard-card__title" href="/leaderboard">
        <span><Trophy size={18} aria-hidden="true" />Leaderboard</span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      {visibleRows.length ? (
        <ol className="sb-leaderboard-list">
          {visibleRows.map((row) => (
            <li className={row.isCurrentUser ? 'is-viewer' : undefined} key={row.userId}>
              <span className="sb-leaderboard-rank">{row.rank}</span>
              <Link href={`/@${row.username}`}>{row.displayName}</Link>
              <strong>{points.format(row.points)} pts</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="sb-leaderboard-card__empty">Scores appear after the first market resolves.</p>
      )}
    </aside>
  );
}
