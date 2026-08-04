import { describe, expect, it } from 'vitest';
import {
  parseSteamBetDraft,
  sanitizeSteamBetDraft,
  STEAM_BET_INPUT_LIMITS,
} from './steam-bets';

describe('Steam bet input limits', () => {
  it('uses the requested character limits for every prediction target', () => {
    expect(STEAM_BET_INPUT_LIMITS).toEqual({
      first_weekend_ccu: 7,
      first_month_reviews: 6,
      full_price_us: 7,
      launch_discount: 3,
    });
  });

  it('truncates integer predictions and removes non-digits', () => {
    expect(sanitizeSteamBetDraft('first_weekend_ccu', '12x3456789')).toBe('1234567');
    expect(sanitizeSteamBetDraft('first_month_reviews', '987654321')).toBe('987654');
    expect(sanitizeSteamBetDraft('launch_discount', '12x34')).toBe('123');
  });

  it('keeps one decimal separator for price and enforces seven characters', () => {
    expect(sanitizeSteamBetDraft('full_price_us', '123,4567')).toBe('123.456');
    expect(sanitizeSteamBetDraft('full_price_us', '12.3.45')).toBe('12.345');
  });

  it('rejects over-limit or malformed values on the server boundary', () => {
    expect(parseSteamBetDraft('first_weekend_ccu', '1234567')).toBe(1_234_567);
    expect(parseSteamBetDraft('first_weekend_ccu', '12345678')).toBeNull();
    expect(parseSteamBetDraft('first_month_reviews', '123456')).toBe(123_456);
    expect(parseSteamBetDraft('first_month_reviews', '1234567')).toBeNull();
    expect(parseSteamBetDraft('full_price_us', '9999.99')).toBe(9_999.99);
    expect(parseSteamBetDraft('full_price_us', '10000.00')).toBeNull();
    expect(parseSteamBetDraft('full_price_us', '12.3.4')).toBeNull();
    expect(parseSteamBetDraft('launch_discount', '100')).toBe(100);
    expect(parseSteamBetDraft('launch_discount', '101')).toBeNull();
  });
});
