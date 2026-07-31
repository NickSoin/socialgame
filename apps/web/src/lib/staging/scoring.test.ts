import { describe, expect, it } from 'vitest';
import { canonicalPoints, percentileValue, scoreInputs } from './scoring';

describe('staging canonical scoring', () => {
  it('matches the production leave-one-out improvement formula', () => {
    expect(canonicalPoints(90, 60, 100)).toBe(30);
    expect(canonicalPoints(60, 60, 100)).toBe(0);
    expect(canonicalPoints(20, 60, 100)).toBe(-40);
    expect(scoreInputs(90, 60, 100)).toEqual({ userError: 10, crowdError: 40, points: 30 });
  });

  it('uses the version-one Steam percentile reference datasets', () => {
    expect(percentileValue('first_weekend_ccu', 6_500)).toBe(50);
    expect(percentileValue('first_month_reviews', 650)).toBe(50);
    expect(percentileValue('full_price_us', 24.99)).toBe(58);
  });

  it('rejects negative or non-finite forecasts', () => {
    expect(() => percentileValue('first_weekend_ccu', -1)).toThrow(RangeError);
    expect(() => percentileValue('first_month_reviews', Number.NaN)).toThrow(RangeError);
  });
});
