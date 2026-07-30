import { describe, expect, it } from "vitest";
import { buildSteamFeed } from "./steam-feed";
import { STEAM_BET_TARGETS, type SteamUpcomingGame } from "./steam-bets";

const game = (appId: number, name: string): SteamUpcomingGame => ({
  appId,
  name,
  releaseDate: "2026-08-01",
  releaseLabel: "Aug 1",
  imageUrl: `https://example.com/${appId}.jpg`,
  wishlistRank: null,
  targets: STEAM_BET_TARGETS.map((target) => ({
    ...target,
    averageValue: null,
    predictionCount: 0,
    userValue: null,
  })),
});

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
      predictionCount: 7_000_000,
    });
  });
});
