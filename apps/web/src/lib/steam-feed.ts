import {
  STEAM_BET_TARGETS,
  type SteamBetRow,
  type SteamBetSummary,
  type SteamBetTrend,
  type SteamUpcomingGame,
} from './steam-bets';

export type SteamFeedMode = 'upcoming' | 'trending' | 'involved';

function fromSnapshot(row: SteamBetRow | SteamBetTrend): SteamUpcomingGame | null {
  if (!row.game_name || !row.release_date || !row.release_label || !row.image_url) return null;
  return {
    appId: row.steam_app_id,
    name: row.game_name,
    releaseDate: row.release_date,
    releaseLabel: row.release_label,
    imageUrl: row.image_url,
    targets: STEAM_BET_TARGETS.map((target) => ({
      ...target,
      averageValue: null,
      predictionCount: 0,
      userValue: null,
    })),
  };
}

export function buildSteamFeed({
  mode,
  liveGames,
  bets,
  summaries = [],
  trends,
}: {
  mode: SteamFeedMode;
  liveGames: SteamUpcomingGame[];
  bets: SteamBetRow[];
  summaries?: SteamBetSummary[];
  trends: SteamBetTrend[];
}): SteamUpcomingGame[] {
  const games = new Map(liveGames.map((game) => [game.appId, game]));

  if (mode === 'trending') {
    for (const trend of trends) {
      if (!games.has(trend.steam_app_id)) {
        const snapshot = fromSnapshot(trend);
        if (snapshot) games.set(snapshot.appId, snapshot);
      }
    }
  }

  if (mode === 'involved') {
    for (const bet of bets) {
      if (!games.has(bet.steam_app_id)) {
        const snapshot = fromSnapshot(bet);
        if (snapshot) games.set(snapshot.appId, snapshot);
      }
    }
  }

  const betValues = new Map(
    bets.map((bet) => [`${bet.steam_app_id}:${bet.target_key}`, bet.value]),
  );
  const summaryValues = new Map(
    summaries.map((summary) => [
      `${summary.steam_app_id}:${summary.target_key}`,
      summary,
    ]),
  );
  const involvedIds = new Set(bets.map((bet) => bet.steam_app_id));
  const trendCounts = new Map(trends.map((trend) => [trend.steam_app_id, trend.bet_count]));

  let result = [...games.values()];
  if (mode === 'involved') result = result.filter((game) => involvedIds.has(game.appId));
  if (mode === 'trending') {
    result.sort((a, b) => (trendCounts.get(b.appId) ?? 0) - (trendCounts.get(a.appId) ?? 0));
  }

  return result.map((game) => ({
    ...game,
    targets: game.targets.map((target) => ({
      ...target,
      averageValue:
        summaryValues.get(`${game.appId}:${target.key}`)?.average_value ?? null,
      predictionCount:
        summaryValues.get(`${game.appId}:${target.key}`)?.prediction_count ?? 0,
      userValue: betValues.get(`${game.appId}:${target.key}`) ?? null,
    })),
  }));
}
