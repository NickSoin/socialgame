import {
  type SteamBetRow,
  type SteamBetSummary,
  type SteamBetTrend,
  type SteamUpcomingGame,
  type SteamPredictionState,
} from "./steam-bets";

export type SteamFeedMode = "upcoming" | "trending" | "involved";

export function buildSteamFeed({
  mode,
  liveGames,
  bets,
  summaries = [],
  trends,
  states = [],
}: {
  mode: SteamFeedMode;
  liveGames: SteamUpcomingGame[];
  bets: SteamBetRow[];
  summaries?: SteamBetSummary[];
  trends: SteamBetTrend[];
  states?: SteamPredictionState[];
}): SteamUpcomingGame[] {
  const betValues = new Map(
    bets.map((bet) => [`${bet.steam_app_id}:${bet.target_key}`, bet.value]),
  );
  const summaryValues = new Map(
    summaries.map((summary) => [`${summary.steam_app_id}:${summary.target_key}`, summary]),
  );
  const involvedIds = new Set(bets.map((bet) => bet.steam_app_id));
  const trendCounts = new Map(trends.map((trend) => [trend.steam_app_id, trend.bet_count]));
  const predictionStates = new Map(
    states.map((state) => [`${state.steam_app_id}:${state.metric_type}`, state]),
  );

  let result = [...liveGames];
  if (mode === "involved") result = result.filter((game) => involvedIds.has(game.appId));
  if (mode === "trending") {
    result.sort((a, b) => (trendCounts.get(b.appId) ?? 0) - (trendCounts.get(a.appId) ?? 0));
  }

  return result.map((game) => ({
    ...game,
    targets: game.targets.map((target) => ({
      ...target,
      ...(() => {
        const state = predictionStates.get(`${game.appId}:${target.key}`);
        return {
          userPercentile: state?.user_percentile_value ?? null,
          marketStatus: state?.market_status ?? "open",
          lockAt: state?.lock_at ?? null,
          actualValue: state?.actual_raw_value ?? null,
          actualPercentile: state?.actual_percentile_value ?? null,
          points: state?.points ?? 0,
          scoredDays: state?.scored_days ?? 0,
        };
      })(),
      averageValue: summaryValues.get(`${game.appId}:${target.key}`)?.average_value ?? null,
      predictionCount: summaryValues.get(`${game.appId}:${target.key}`)?.prediction_count ?? 0,
      userValue:
        predictionStates.get(`${game.appId}:${target.key}`)?.user_raw_value
        ?? betValues.get(`${game.appId}:${target.key}`)
        ?? null,
    })),
  }));
}
