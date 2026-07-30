import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ForecastFeed } from '@/components/steambets/forecast-feed';
import { getCurrentUserSteamBets, getSteamBetTrends } from '@/data/steam-bets';
import { getSteamPopularUpcoming } from '@/data/steam-popular-upcoming';
import { buildSteamFeed, type SteamFeedMode } from '@/lib/steam-feed';

const TITLES: Record<SteamFeedMode, string> = {
  upcoming: 'Popular upcoming Steam games',
  trending: 'Trending Steam games',
  involved: 'Steam games you predicted',
};

export async function SteamFeedPage({
  mode,
  searchParams,
}: {
  mode: SteamFeedMode;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q = '' }, liveGames, userState, trends] = await Promise.all([
    searchParams,
    getSteamPopularUpcoming(),
    getCurrentUserSteamBets(),
    mode === 'trending'
      ? getSteamBetTrends().catch((error: unknown) => {
          console.error('Could not load trending Steam games.', error);
          return [];
        })
      : Promise.resolve([]),
  ]);

  if (mode === 'involved' && !userState.isAuthenticated) redirect('/login?next=/involved');

  const query = q.trim().toLocaleLowerCase('en-US');
  const games = buildSteamFeed({
    mode,
    liveGames,
    bets: userState.bets,
    trends,
  }).filter((game) => !query || game.name.toLocaleLowerCase('en-US').includes(query));

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
          <h1>{query ? 'No games found' : mode === 'involved' ? 'No bets yet' : 'No games yet'}</h1>
          <Link href={mode === 'involved' && !query ? '/' : mode === 'upcoming' ? '/' : `/${mode}`}>
            {query ? 'Clear search' : mode === 'involved' ? 'View upcoming games' : 'Refresh'}
          </Link>
        </main>
      )}
    </div>
  );
}
