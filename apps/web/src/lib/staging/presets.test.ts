import { describe, expect, it } from 'vitest';
import { getPreset, SIMULATION_PRESETS } from './presets';

describe('simulation presets', () => {
  it('ships every required gameplay scenario', () => {
    expect(SIMULATION_PRESETS.map((preset) => preset.key)).toEqual([
      'market_predicts_correctly',
      'early_contrarian',
      'viral_hit',
      'overhyped_failure',
      'sparse_market',
      'two_player_edge',
      'outlier_manipulation',
      'perfect_follower',
      'edits_over_time',
      'corrected_resolution',
    ]);
  });

  it('contains resolvable outcomes for every supported metric', () => {
    for (const preset of SIMULATION_PRESETS) {
      for (const game of preset.games) {
        expect(game.values.first_weekend_ccu).toBeGreaterThanOrEqual(0);
        expect(game.values.first_month_reviews).toBeGreaterThanOrEqual(0);
        expect(game.values.full_price_us).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rejects unknown presets', () => {
    expect(() => getPreset('not-a-preset')).toThrow(/Unknown simulation preset/);
  });
});
