import { describe, expect, it, vi } from "vitest";
import { toSteamUpcomingGame } from "./steam-game-catalog";

describe("toSteamUpcomingGame", () => {
  it("maps a dated wishlist catalog row into a forecast card", () => {
    const game = toSteamUpcomingGame({
      steam_app_id: 388860,
      name: "Judas",
      image_url:
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/388860/header.jpg",
      release_date: "2027-03-15",
      release_label: "March 15",
      tags: ["Action", "RPG"],
      lifecycle_status: "upcoming",
      pre_release_rank: 12,
      wishlist_rank: 12,
      source_updated_at: "2026-08-01T08:00:00.000Z",
      follower_count: 45_678,
      followers_updated_at: "2026-08-01T09:00:00.000Z",
    });

    expect(game).toMatchObject({
      appId: 388860,
      name: "Judas",
      releaseDate: "2027-03-15T00:00:00.000Z",
      releaseLabel: "March 15",
      wishlistRank: 12,
      wishlistRankUpdatedAt: "2026-08-01T08:00:00.000Z",
      followerCount: 45_678,
      followersUpdatedAt: "2026-08-01T09:00:00.000Z",
      imageUrl: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/388860/header.jpg",
      tags: ["Action", "RPG"],
    });
    expect(game.targets).toHaveLength(3);
  });

  it("maps active database media in position order without a per-game source map", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const game = toSteamUpcomingGame({
      steam_app_id: 42,
      name: "Media Test",
      image_url: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/42/header.jpg",
      release_date: null,
      release_label: "TBA",
      tags: [],
      lifecycle_status: "upcoming",
      pre_release_rank: 1,
      wishlist_rank: 1,
      follower_count: null,
      steam_game_media: [
        { active: true, kind: "screenshot", position: 2, storage_bucket: "steam-game-media", storage_path: "42/screenshots/2-bbbbbbbbbbbb.webp" },
        { active: true, kind: "screenshot", position: 1, storage_bucket: "steam-game-media", storage_path: "42/screenshots/1-aaaaaaaaaaaa.webp" },
      ],
    });

    expect(game.previewUrls).toEqual([
      "https://example.supabase.co/storage/v1/object/public/steam-game-media/42/screenshots/1-aaaaaaaaaaaa.webp",
      "https://example.supabase.co/storage/v1/object/public/steam-game-media/42/screenshots/2-bbbbbbbbbbbb.webp",
    ]);
    vi.unstubAllEnvs();
  });

  it("keeps unknown release dates open as TBA", () => {
    const game = toSteamUpcomingGame({
      steam_app_id: 17750,
      name: "Obsidian Conflict",
      image_url:
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/17750/header.jpg",
      release_date: null,
      release_label: "TBA",
      tags: [],
      lifecycle_status: "upcoming",
      pre_release_rank: null,
      wishlist_rank: null,
      follower_count: null,
    });

    expect(game.releaseDate).toBe("TBA");
    expect(game.releaseLabel).toBe("TBA");
  });

  it("shows only the first five Steam genres", () => {
    const game = toSteamUpcomingGame({
      steam_app_id: 42,
      name: "Genre Test",
      image_url: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/42/header.jpg",
      release_date: null,
      release_label: "TBA",
      tags: ["Action", "RPG", "Indie", "Adventure", "Simulation", "Strategy"],
      lifecycle_status: "upcoming",
      pre_release_rank: 1,
      wishlist_rank: 1,
      follower_count: null,
    });

    expect(game.tags).toEqual(["Action", "RPG", "Indie", "Adventure", "Simulation"]);
  });

  it("maps a released game to a closed card and preserves its pre-release rank", () => {
    const game = toSteamUpcomingGame({
      steam_app_id: 99,
      name: "Released Game",
      image_url: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/99/header.jpg",
      release_date: "2026-07-31",
      release_label: "July 31",
      tags: ["Indie"],
      lifecycle_status: "released",
      pre_release_rank: 7,
      wishlist_rank: null,
      follower_count: null,
    });

    expect(game).toMatchObject({
      lifecycleStatus: "released",
      wishlistRank: 7,
    });
  });
});
