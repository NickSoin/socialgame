import { describe, expect, test } from 'vitest';

import {
  calculatePotentialPayout,
  calculatePotentialProfit,
  calculatePredictionQuote,
  calculateShares,
  formatOdds,
  formatProbability,
  getOutcomePriceBps,
  isValidPriceBps,
  isValidStake,
  validatePriceBps,
  validateStake,
} from './prediction-math';

describe('prediction input validation', () => {
  test('accepts positive whole-coin stakes', () => {
    expect(isValidStake(1)).toBe(true);
    expect(isValidStake(25_000)).toBe(true);
    expect(validateStake(500)).toBe(500);
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '100']) (
    'rejects invalid stake %s',
    (stake) => {
      expect(isValidStake(stake)).toBe(false);
      expect(() => validateStake(stake)).toThrow();
    },
  );

  test('accepts only tradable integer prices', () => {
    expect(isValidPriceBps(1)).toBe(true);
    expect(isValidPriceBps(9_999)).toBe(true);
    expect(validatePriceBps(6_250)).toBe(6_250);
  });

  test.each([0, 10_000, -1, 12.5, Number.NaN, '5000']) (
    'rejects invalid price %s',
    (price) => {
      expect(isValidPriceBps(price)).toBe(false);
      expect(() => validatePriceBps(price)).toThrow();
    },
  );
});

describe('binary outcome pricing', () => {
  test('uses the YES price directly and complements it for NO', () => {
    expect(getOutcomePriceBps(7_000, 'YES')).toBe(7_000);
    expect(getOutcomePriceBps(7_000, 'NO')).toBe(3_000);
  });

  test('rejects an invalid runtime outcome', () => {
    expect(() => getOutcomePriceBps(5_000, 'MAYBE' as 'YES')).toThrow(
      'Outcome must be either YES or NO.',
    );
  });
});

describe('integer-safe payout math', () => {
  test('quotes an exact YES prediction', () => {
    expect(
      calculatePredictionQuote({ stake: 100, yesPriceBps: 2_500, outcome: 'YES' }),
    ).toEqual({
      stake: 100,
      outcome: 'YES',
      yesPriceBps: 2_500,
      outcomePriceBps: 2_500,
      shares: 400,
      potentialPayout: 400,
      potentialProfit: 300,
      probabilityPercent: 25,
      decimalOdds: 4,
      displayedPercentage: '25%',
      displayedOdds: '4.00×',
    });
  });

  test('quotes NO from the complementary price', () => {
    expect(
      calculatePredictionQuote({ stake: 100, yesPriceBps: 7_000, outcome: 'NO' }),
    ).toEqual({
      stake: 100,
      outcome: 'NO',
      yesPriceBps: 7_000,
      outcomePriceBps: 3_000,
      shares: 333,
      potentialPayout: 333,
      potentialProfit: 233,
      probabilityPercent: 30,
      decimalOdds: 3.33,
      displayedPercentage: '30%',
      displayedOdds: '3.33×',
    });
  });

  test('floors fractional shares exactly like integer database division', () => {
    expect(calculateShares(100, 3_333)).toBe(300);
    expect(calculatePotentialPayout(100, 3_333)).toBe(300);
    expect(calculatePotentialProfit(100, 3_333)).toBe(200);
  });

  test('uses BigInt intermediates when stake multiplication is not number-safe', () => {
    expect(calculateShares(1_000_000_000_000, 9_999)).toBe(1_000_100_010_001);
  });

  test('rejects a quote whose result cannot be represented safely', () => {
    expect(() => calculateShares(Number.MAX_SAFE_INTEGER, 1)).toThrow(
      "Calculated shares exceeds JavaScript's safe integer range.",
    );
  });
});

describe('display values', () => {
  test.each([
    [1, '0.01%'],
    [120, '1.2%'],
    [1_250, '12.5%'],
    [5_000, '50%'],
    [9_999, '99.99%'],
  ])('formats %i bps as %s', (price, expected) => {
    expect(formatProbability(price)).toBe(expected);
  });

  test('rounds decimal odds half-up without affecting payout flooring', () => {
    expect(formatOdds(4_000)).toBe('2.50×');
    expect(formatOdds(6_000)).toBe('1.67×');
    expect(calculateShares(100, 6_000)).toBe(166);
  });
});
