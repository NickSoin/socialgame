import { describe, expect, it } from "vitest";
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
      wishlist_rank: 12,
    });

    expect(game).toMatchObject({
      appId: 388860,
      name: "Judas",
      releaseDate: "2027-03-15T00:00:00.000Z",
      releaseLabel: "March 15",
      wishlistRank: 12,
      imageUrl: "/api/steam-artwork/388860",
      tags: ["Action", "RPG"],
    });
    expect(game.targets).toHaveLength(3);
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
      wishlist_rank: null,
    });

    expect(game.releaseDate).toBe("TBA");
    expect(game.releaseLabel).toBe("TBA");
  });
});
