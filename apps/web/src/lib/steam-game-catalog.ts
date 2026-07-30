import { STEAM_BET_TARGETS, type SteamUpcomingGame } from './steam-bets';

export type SteamGameCatalogRecord = {
  steam_app_id: number;
  name: string;
  image_url: string;
  release_date: string | null;
  release_label: string;
};

export function toSteamUpcomingGame(row: SteamGameCatalogRecord): SteamUpcomingGame {
  return {
    appId: Number(row.steam_app_id),
    name: row.name,
    imageUrl: row.image_url,
    releaseDate: row.release_date
      ? `${row.release_date}T00:00:00.000Z`
      : 'TBA',
    releaseLabel: row.release_label || 'TBA',
    targets: STEAM_BET_TARGETS.map((target) => ({
      ...target,
      averageValue: null,
      predictionCount: 0,
      userValue: null,
    })),
  };
}
