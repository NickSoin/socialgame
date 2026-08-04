import type { BotBehavior, SimulationPreset, StagingMetric } from './types';

const baseValues = (
  ccu: number,
  reviews: number,
  price: number,
  discount = 10,
): Record<StagingMetric, number> => ({
  first_weekend_ccu: ccu,
  first_month_reviews: reviews,
  full_price_us: price,
  launch_discount: discount,
});

const oneGame = (
  key: string,
  name: string,
  description: string,
  players: number,
  values: Record<StagingMetric, number>,
  behaviorWeights?: Partial<Record<BotBehavior, number>>,
  extras?: Pick<SimulationPreset, 'sparsity' | 'editRate'>,
): SimulationPreset => ({
  key,
  name,
  description,
  players,
  games: [{ name: `${name} Test Game`, releaseOffsetDays: 14, values }],
  behaviorWeights,
  ...extras,
});

export const SIMULATION_PRESETS: readonly SimulationPreset[] = [
  oneGame('market_predicts_correctly', 'Market predicts correctly', 'A calibrated crowd converges near all four outcomes.', 80, baseValues(18_000, 4_200, 29.99), { follower: 0.45, expert: 0.35, random: 0.2 }),
  oneGame('early_contrarian', 'Early contrarian', 'A skilled contrarian is right before the crowd catches up.', 60, baseValues(55_000, 9_500, 39.99), { follower: 0.55, contrarian: 0.2, expert: 0.25 }, { editRate: 0.35 }),
  oneGame('viral_hit', 'Viral hit', 'Late external signals move forecasts sharply upward.', 120, baseValues(420_000, 68_000, 24.99), { follower: 0.5, late: 0.3, expert: 0.2 }, { editRate: 0.45 }),
  oneGame('overhyped_failure', 'Overhyped failure', 'The crowd overestimates a heavily wishlisted launch.', 100, baseValues(2_200, 450, 59.99), { follower: 0.65, expert: 0.15, contrarian: 0.2 }),
  oneGame('sparse_market', 'Sparse market', 'Very few forecasts exercise empty and single-player snapshots.', 5, baseValues(600, 90, 14.99), { random: 1 }, { sparsity: 0.72 }),
  oneGame('two_player_edge', 'Two-player edge', 'Exactly two eligible forecasts test leave-one-out scoring.', 2, baseValues(8_500, 1_100, 19.99), { expert: 0.5, random: 0.5 }),
  oneGame('outlier_manipulation', 'Outlier manipulation', 'Several extreme forecasts stress crowd robustness.', 70, baseValues(22_000, 3_400, 34.99), { follower: 0.55, outlier: 0.25, expert: 0.2 }),
  oneGame('perfect_follower', 'Perfect follower', 'A follower matches the contemporaneous crowd exactly.', 40, baseValues(12_000, 2_000, 19.99), { follower: 0.75, random: 0.25 }),
  oneGame('edits_over_time', 'Edits over time', 'Players revise forecasts repeatedly while history remains immutable.', 45, baseValues(75_000, 14_000, 49.99), { late: 0.4, expert: 0.3, follower: 0.3 }, { editRate: 0.8 }),
  oneGame('corrected_resolution', 'Corrected resolution', 'A resolved result is corrected and scores are rebuilt safely.', 50, baseValues(30_000, 6_000, 29.99), { expert: 0.4, follower: 0.4, random: 0.2 }),
] as const;

export function getPreset(key: string) {
  const preset = SIMULATION_PRESETS.find((candidate) => candidate.key === key);
  if (!preset) throw new Error(`Unknown simulation preset: ${key}`);
  return preset;
}
