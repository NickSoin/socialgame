/**
 * Integer-safe quote math for fixed-price, play-money binary predictions.
 *
 * Prices are probabilities in basis points: 1 = 0.01%, 10_000 = 100%.
 * A winning share pays one platform coin, so buying at `priceBps` uses:
 *
 *   shares = floor(stake * 10_000 / priceBps)
 *
 * This module is an independent implementation of the product's database
 * formula. It does not contain copied prediction-market source code.
 */

export const PRICE_BPS_SCALE = 10_000;
export const MIN_PRICE_BPS = 1;
export const MAX_PRICE_BPS = PRICE_BPS_SCALE - 1;

export type PredictionOutcome = 'YES' | 'NO';

export type PredictionQuoteInput = Readonly<{
  stake: number;
  yesPriceBps: number;
  outcome: PredictionOutcome;
}>;

export type PredictionQuote = Readonly<{
  stake: number;
  outcome: PredictionOutcome;
  yesPriceBps: number;
  outcomePriceBps: number;
  shares: number;
  potentialPayout: number;
  potentialProfit: number;
  probabilityPercent: number;
  decimalOdds: number;
  displayedPercentage: string;
  displayedOdds: string;
}>;

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Returns true when a stake is a positive, safely representable coin amount. */
export function isValidStake(stake: unknown): stake is number {
  return isSafeInteger(stake) && stake > 0;
}

/**
 * Returns true for a tradable probability. Zero and 100% are excluded because
 * one side would have a zero price and could not be quoted.
 */
export function isValidPriceBps(priceBps: unknown): priceBps is number {
  return (
    isSafeInteger(priceBps) &&
    priceBps >= MIN_PRICE_BPS &&
    priceBps <= MAX_PRICE_BPS
  );
}

/** Validates and returns a stake for convenient use at input boundaries. */
export function validateStake(stake: unknown): number {
  if (!isSafeInteger(stake)) {
    throw new TypeError('Stake must be a safe integer number of platform coins.');
  }

  if (stake <= 0) {
    throw new RangeError('Stake must be greater than zero.');
  }

  return stake;
}

/** Validates and returns a tradable price in basis points. */
export function validatePriceBps(priceBps: unknown): number {
  if (!isSafeInteger(priceBps)) {
    throw new TypeError('Price must be a safe integer number of basis points.');
  }

  if (priceBps < MIN_PRICE_BPS || priceBps > MAX_PRICE_BPS) {
    throw new RangeError(
      `Price must be between ${MIN_PRICE_BPS} and ${MAX_PRICE_BPS} basis points.`,
    );
  }

  return priceBps;
}

/** Alias that documents when the supplied price specifically belongs to YES. */
export const validateYesPriceBps = validatePriceBps;

function validateOutcome(outcome: unknown): asserts outcome is PredictionOutcome {
  if (outcome !== 'YES' && outcome !== 'NO') {
    throw new RangeError('Outcome must be either YES or NO.');
  }
}

/** Returns the selected side's price from the market's YES price. */
export function getOutcomePriceBps(
  yesPriceBps: number,
  outcome: PredictionOutcome,
): number {
  const validatedYesPrice = validatePriceBps(yesPriceBps);
  validateOutcome(outcome);

  return outcome === 'YES'
    ? validatedYesPrice
    : PRICE_BPS_SCALE - validatedYesPrice;
}

function toSafeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} exceeds JavaScript's safe integer range.`);
  }

  return Number(value);
}

/**
 * Calculates whole winning shares using the same floor division as the
 * database. BigInt intermediates prevent precision loss in `stake * 10_000`.
 */
export function calculateShares(stake: number, outcomePriceBps: number): number {
  const validatedStake = validateStake(stake);
  const validatedPrice = validatePriceBps(outcomePriceBps);
  const shares =
    (BigInt(validatedStake) * BigInt(PRICE_BPS_SCALE)) /
    BigInt(validatedPrice);

  return toSafeNumber(shares, 'Calculated shares');
}

/** A winning share pays one platform coin. */
export function calculatePotentialPayout(
  stake: number,
  outcomePriceBps: number,
): number {
  return calculateShares(stake, outcomePriceBps);
}

/** Potential net profit after returning the original stake. */
export function calculatePotentialProfit(
  stake: number,
  outcomePriceBps: number,
): number {
  const validatedStake = validateStake(stake);
  return calculatePotentialPayout(validatedStake, outcomePriceBps) - validatedStake;
}

function formatHundredths(value: number): string {
  const whole = Math.floor(value / 100);
  const fraction = String(value % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

/** Formats exact basis points as a percentage without floating-point rounding. */
export function formatProbability(priceBps: number): string {
  const validatedPrice = validatePriceBps(priceBps);
  const whole = Math.floor(validatedPrice / 100);
  const fraction = validatedPrice % 100;

  if (fraction === 0) return `${whole}%`;
  if (fraction % 10 === 0) return `${whole}.${fraction / 10}%`;
  return `${whole}.${String(fraction).padStart(2, '0')}%`;
}

/**
 * Formats theoretical decimal odds to two places using integer half-up
 * rounding. Quote payouts themselves always use floor division instead.
 */
export function formatOdds(priceBps: number): string {
  const validatedPrice = validatePriceBps(priceBps);
  const price = BigInt(validatedPrice);
  const numerator = BigInt(PRICE_BPS_SCALE) * BigInt(100);
  const oddsHundredths = (numerator + price / BigInt(2)) / price;

  return `${formatHundredths(toSafeNumber(oddsHundredths, 'Displayed odds'))}×`;
}

export const formatDecimalOdds = formatOdds;

/** Builds a complete quote for either side of a binary market. */
export function calculatePredictionQuote(
  input: PredictionQuoteInput,
): PredictionQuote {
  const stake = validateStake(input.stake);
  const yesPriceBps = validatePriceBps(input.yesPriceBps);
  const outcomePriceBps = getOutcomePriceBps(yesPriceBps, input.outcome);
  const shares = calculateShares(stake, outcomePriceBps);
  const oddsHundredths = Number(
    (BigInt(PRICE_BPS_SCALE) * BigInt(100) +
      BigInt(outcomePriceBps) / BigInt(2)) /
      BigInt(outcomePriceBps),
  );

  return {
    stake,
    outcome: input.outcome,
    yesPriceBps,
    outcomePriceBps,
    shares,
    potentialPayout: shares,
    potentialProfit: shares - stake,
    probabilityPercent: outcomePriceBps / 100,
    decimalOdds: oddsHundredths / 100,
    displayedPercentage: formatProbability(outcomePriceBps),
    displayedOdds: formatOdds(outcomePriceBps),
  };
}

export const calculateBinaryPrediction = calculatePredictionQuote;
