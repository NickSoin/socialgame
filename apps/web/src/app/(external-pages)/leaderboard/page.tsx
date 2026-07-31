import { LeaderboardPage } from '@/components/steambets/leaderboard-page';
import { Suspense } from 'react';

export default function Page(props: { searchParams: Promise<{ metric?: string; page?: string }> }) {
  return (
    <Suspense fallback={<main className="sb-shell sb-leaderboard-page sb-muted">Loading leaderboard…</main>}>
      <LeaderboardPage {...props} />
    </Suspense>
  );
}
