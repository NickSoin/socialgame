import { describe, expect, it } from "vitest";
import { buildSteamFeed } from "./steam-feed";
import { STEAM_BET_TARGETS, type SteamUpcomingGame } from "./steam-bets";

const game = (appId: number, name: string): SteamUpcomingGame => ({
  appId,
  name,
  lifecycleStatus: "upcoming",
  releaseDate: "2026-08-01",
  releaseLabel: "Aug 1",
  imageUrl: `https://example.com/${appId}.jpg`,
  tags: [],
  wishlistRank: null,
  targets: STEAM_BET_TARGETS.map((target) => ({
    ...target,
    averageValue: null,
    averageHistory: [],
    predictionCount: 0,
    userValue: null,
    userPercentile: null,
    marketStatus: "open",
    lockAt: null,
    actualValue: null,
    actualPercentile: null,
    points: 0,
    scoredDays: 0,
  })),
});

const marketStates = (
  appId: number,
  statuses: Array<"open" | "locked" | "resolved" | "void">,
) => STEAM_BET_TARGETS.map((target, index) => ({
  steam_app_id: appId,
  metric_type: target.key,
  market_status: statuses[index] ?? "open",
  lock_at: "2026-08-01T00:00:00Z",
  resolve_after: "2026-08-31T00:00:00Z",
  user_raw_value: null,
  user_percentile_value: null,
  actual_raw_value: null,
  actual_percentile_value: null,
  points: 0,
  scored_days: 0,
}));

describe("buildSteamFeed", () => {
  it("sorts trending games by total bets", () => {
    const games = buildSteamFeed({
      mode: "trending",
      liveGames: [game(1, "One"), game(2, "Two")],
      bets: [],
      trends: [
        {
          steam_app_id: 1,
          bet_count: 2,
          game_name: null,
          release_date: null,
          release_label: null,
          image_url: null,
        },
        {
          steam_app_id: 2,
          bet_count: 8,
          game_name: null,
          release_date: null,
          release_label: null,
          image_url: null,
        },
      ],
    });
    expect(games.map(({ appId }) => appId)).toEqual([2, 1]);
  });

  it("never includes released games in trending or popular upcoming feeds", () => {
    const upcoming = game(1, "Upcoming");
    const released = { ...game(2, "Released"), lifecycleStatus: "released" as const };

    for (const mode of ["upcoming", "trending"] as const) {
      const games = buildSteamFeed({
        mode,
        liveGames: [released, upcoming],
        bets: [],
        trends: [{
          steam_app_id: released.appId,
          bet_count: 100,
          game_name: released.name,
          release_date: "2026-07-31",
          release_label: "July 31",
          image_url: released.imageUrl,
        }],
      });

      expect(games.map(({ appId }) => appId)).toEqual([upcoming.appId]);
    }
  });

  it("keeps released games locked until every market is terminal", () => {
    const upcoming = game(1, "Upcoming");
    const released = { ...game(2, "Released"), lifecycleStatus: "released" as const };

    const lockedGames = buildSteamFeed({
      mode: "locked",
      liveGames: [upcoming, released],
      bets: [],
      trends: [],
      states: marketStates(2, ["resolved", "locked", "locked", "locked"]),
    });
    const completedGames = buildSteamFeed({
      mode: "completed",
      liveGames: [upcoming, released],
      bets: [],
      trends: [],
      states: marketStates(2, ["resolved", "resolved", "void", "resolved"]),
    });

    expect(lockedGames.map(({ appId }) => appId)).toEqual([released.appId]);
    expect(completedGames.map(({ appId }) => appId)).toEqual([released.appId]);
  });

  it("keeps only canonical catalog games in the involved feed and restores locked values", () => {
    const games = buildSteamFeed({
      mode: "involved",
      liveGames: [game(3, "Archive Game")],
      trends: [],
      bets: [
        {
          steam_app_id: 3,
          target_key: "first_weekend_ccu",
          value: 90,
          created_at: "2026-07-30T00:00:00Z",
          game_name: "Archive Game",
          release_date: "2026-09-01",
          release_label: "Sep 1",
          image_url: "https://example.com/3.jpg",
        },
      ],
    });
    expect(games).toHaveLength(1);
    expect(games[0]?.targets[0]?.userValue).toBe(90);
  });

  it("does not render involved snapshots for games removed from TopWishlisted", () => {
    const games = buildSteamFeed({
      mode: "involved",
      liveGames: [],
      trends: [],
      bets: [
        {
          steam_app_id: 3,
          target_key: "first_weekend_ccu",
          value: 90,
          created_at: "2026-07-30T00:00:00Z",
          game_name: "Removed Game",
          release_date: "TBA",
          release_label: "TBA",
          image_url: "https://example.com/3.jpg",
        },
      ],
    });

    expect(games).toEqual([]);
  });

  it("keeps the canonical catalog date after a prediction is approved", () => {
    const catalogGame = {
      ...game(3, "Canonical Game"),
      releaseDate: "2026-09-01T00:00:00.000Z",
      releaseLabel: "September 1",
    };
    const games = buildSteamFeed({
      mode: "involved",
      liveGames: [catalogGame],
      trends: [],
      bets: [
        {
          steam_app_id: 3,
          target_key: "first_weekend_ccu",
          value: 90,
          created_at: "2026-07-30T00:00:00Z",
          game_name: "Canonical Game",
          release_date: "TBA",
          release_label: "TBA",
          image_url: "https://example.com/3.jpg",
        },
      ],
    });

    expect(games[0]).toMatchObject({
      releaseDate: "2026-09-01T00:00:00.000Z",
      releaseLabel: "September 1",
    });
  });

  it("adds target-level average and volume summaries to every game card", () => {
    const games = buildSteamFeed({
      mode: "upcoming",
      liveGames: [game(1, "One")],
      bets: [],
      trends: [],
      summaries: [
        {
          steam_app_id: 1,
          target_key: "first_weekend_ccu",
          average_value: 200,
          prediction_count: 7_000_000,
        },
      ],
    });

    expect(games[0]?.targets[0]).toMatchObject({
      averageValue: 200,
      averageHistory: [],
      predictionCount: 7_000_000,
    });
  });

  it("hydrates a card with the user's percentile, lifecycle, result, and points", () => {
    const games = buildSteamFeed({
      mode: "upcoming",
      liveGames: [game(1, "One")],
      bets: [],
      trends: [],
      states: [{
        steam_app_id: 1,
        metric_type: "first_weekend_ccu",
        market_status: "resolved",
        lock_at: "2026-08-01T00:00:00Z",
        resolve_after: "2026-08-03T00:00:00Z",
        user_raw_value: 1000,
        user_percentile_value: 34,
        actual_raw_value: 500,
        actual_percentile_value: 26,
        points: 4,
        scored_days: 2,
      }],
    });

    expect(games[0]?.targets[0]).toMatchObject({
      userValue: 1000,
      userPercentile: 34,
      marketStatus: "resolved",
      actualValue: 500,
      actualPercentile: 26,
      points: 4,
      scoredDays: 2,
    });
  });
});
