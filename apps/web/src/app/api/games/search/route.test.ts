import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ searchSteamCatalogGames: vi.fn() }));

vi.mock("@/data/steam-game-catalog", () => ({
  searchSteamCatalogGames: mocks.searchSteamCatalogGames,
}));

import { GET } from "./route";

afterEach(() => mocks.searchSteamCatalogGames.mockReset());

describe("game catalog search route", () => {
  it("returns ranked games from the searchable wishlist catalog", async () => {
    mocks.searchSteamCatalogGames.mockResolvedValue([
      {
        appId: 1368140,
        imageUrl: "/api/steam-artwork/1368140",
        name: "Corsair Cove",
        releaseDate: "2026-07-31T00:00:00.000Z",
        releaseLabel: "July 31",
        wishlistRank: 77,
        targets: [],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/games/search?q=corsair"));

    expect(mocks.searchSteamCatalogGames).toHaveBeenCalledWith("corsair", 10);
    expect(await response.json()).toEqual({
      games: [
        {
          appId: 1368140,
          imageUrl: "/api/steam-artwork/1368140",
          name: "Corsair Cove",
          releaseLabel: "July 31",
          wishlistRank: 77,
        },
      ],
    });
  });

  it("does not query the catalog for an empty query", async () => {
    const response = await GET(new Request("http://localhost/api/games/search?q=%20"));

    expect(mocks.searchSteamCatalogGames).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ games: [] });
  });
});
