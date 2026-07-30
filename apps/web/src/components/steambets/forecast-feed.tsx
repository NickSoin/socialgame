import type { SteamUpcomingGame } from '@/lib/steam-bets';
import { ForecastCard } from './forecast-card';

export function ForecastFeed({
  games,
  heading,
  isAuthenticated,
}: {
  games: SteamUpcomingGame[];
  heading: string;
  isAuthenticated: boolean;
}) {
  return (
    <main id="main-content" className="sb-game-feed">
      <h1 className="sr-only">{heading}</h1>
      <div className="sb-game-list">
        {games.map((game, index) => (
          <ForecastCard
            game={game}
            isAuthenticated={isAuthenticated}
            key={game.appId}
            priority={index === 0}
          />
        ))}
      </div>
    </main>
  );
}
