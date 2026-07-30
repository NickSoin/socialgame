import { describe, expect, it } from 'vitest';
import { buildSteamFeed } from './steam-feed';
import { STEAM_BET_TARGETS, type SteamUpcomingGame } from './steam-bets';

const game = (appId: number, name: string): SteamUpcomingGame => ({
  appId,
  name,
  releaseDate: '2026-08-01',
  releaseLabel: 'Aug 1',
  imageUrl: `https://example.com/${appId}.jpg`,
  targets: STEAM_BET_TARGETS.map((target) => ({ ...target, userValue: null })),
});

describe('buildSteamFeed', () => {
  it('sorts trending games by total bets', () => {
    const games = buildSteamFeed({
      mode: 'trending',
      liveGames: [game(1, 'One'), game(2, 'Two')],
      bets: [],
      trends: [
        { steam_app_id: 1, bet_count: 2, game_name: null, release_date: null, release_label: null, image_url: null },
        { steam_app_id: 2, bet_count: 8, game_name: null, release_date: null, release_label: null, image_url: null },
      ],
    });
    expect(games.map(({ appId }) => appId)).toEqual([2, 1]);
  });

  it('keeps snapshot games in the involved feed and restores locked values', () => {
    const games = buildSteamFeed({
      mode: 'involved',
      liveGames: [],
      trends: [],
      bets: [{
        steam_app_id: 3,
        target_key: 'first_weekend_ccu',
        value: 90,
        created_at: '2026-07-30T00:00:00Z',
        game_name: 'Archive Game',
        release_date: '2026-09-01',
        release_label: 'Sep 1',
        image_url: 'https://example.com/3.jpg',
      }],
    });
    expect(games).toHaveLength(1);
    expect(games[0]?.targets[0]?.userValue).toBe(90);
  });
});
