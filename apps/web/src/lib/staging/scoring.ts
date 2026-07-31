import type { StagingMetric } from './types';

const REFERENCE_VALUES: Record<StagingMetric, readonly number[]> = {
  first_weekend_ccu: [
    0, 25, 50, 100, 200, 350, 500, 750, 1_000, 1_500, 2_500, 4_000,
    6_500, 10_000, 16_000, 25_000, 40_000, 65_000, 100_000, 175_000,
    300_000, 600_000, 1_000_000, 3_000_000, 10_000_000,
  ],
  first_month_reviews: [
    0, 2, 5, 10, 20, 35, 50, 80, 120, 180, 275, 400, 650, 1_000,
    1_600, 2_500, 4_000, 6_500, 10_000, 18_000, 30_000, 60_000,
    120_000, 300_000, 1_000_000,
  ],
  full_price_us: [
    0, 0.99, 1.99, 2.99, 3.99, 4.99, 5.99, 7.99, 9.99, 11.99, 12.99,
    14.99, 17.99, 19.99, 24.99, 29.99, 34.99, 39.99, 44.99, 49.99,
    59.99, 69.99, 79.99, 89.99, 99.99,
  ],
};

export function percentileValue(metric: StagingMetric, rawValue: number) {
  if (!Number.isFinite(rawValue) || rawValue < 0) throw new RangeError('Forecast must be zero or greater.');
  const reference = REFERENCE_VALUES[metric];
  let below = 0;
  let equal = 0;
  for (const item of reference) {
    if (item < rawValue) below += 1;
    else if (item === rawValue) equal += 1;
  }
  return Math.round(((below + equal * 0.5) * 100 / reference.length) * 10_000) / 10_000;
}

export function canonicalPoints(user: number, crowdWithoutUser: number, actual: number) {
  return Math.abs(actual - crowdWithoutUser) - Math.abs(actual - user);
}

export function scoreInputs(user: number, crowdWithoutUser: number, actual: number) {
  const userError = Math.abs(actual - user);
  const crowdError = Math.abs(actual - crowdWithoutUser);
  return { userError, crowdError, points: crowdError - userError };
}
