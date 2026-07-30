import { describe, expect, it } from "vitest";
import { buildSteamFeed, sortPopularUpcomingGames } from "./steam-feed";
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

  it("keeps snapshot games in the involved feed and restores locked values", () => {
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

describe("sortPopularUpcomingGames", () => {
  it("sorts release days ascending and wishlist ranks ascending within a day", () => {
    const later = { ...game(1, "Later"), releaseDate: "2026-08-02T00:00:00.000Z", wishlistRank: 1 };
    const lowerRank = {
      ...game(2, "Lower rank"),
      releaseDate: "2026-08-01T00:00:00.000Z",
      wishlistRank: 40,
    };
    const higherRank = {
      ...game(3, "Higher rank"),
      releaseDate: "2026-08-01T00:00:00.000Z",
      wishlistRank: 7,
    };

    expect(sortPopularUpcomingGames([later, lowerRank, higherRank]).map(({ appId }) => appId)).toEqual([
      3, 2, 1,
    ]);
  });

  it("places games without a wishlist rank after ranked games on the same day", () => {
    const unranked = { ...game(1, "Unranked"), wishlistRank: null };
    const ranked = { ...game(2, "Ranked"), wishlistRank: 99 };

    expect(sortPopularUpcomingGames([unranked, ranked]).map(({ appId }) => appId)).toEqual([2, 1]);
  });

  it("places unknown release dates last without mutating the source array", () => {
    const unknown = { ...game(1, "Unknown"), releaseDate: "TBA" };
    const known = { ...game(2, "Known"), releaseDate: "2026-08-03T00:00:00.000Z" };
    const source = [unknown, known];

    expect(sortPopularUpcomingGames(source).map(({ appId }) => appId)).toEqual([2, 1]);
    expect(source.map(({ appId }) => appId)).toEqual([1, 2]);
  });
});
