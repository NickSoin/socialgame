import { describe, expect, it } from "vitest";
import { buildSteamCatalogRows } from "../../../database/supabase/functions/sync-steam-catalog/catalog";

describe("buildSteamCatalogRows", () => {
  it("preserves Steam-owned details when the wishlist catalog refreshes", () => {
    const [row] = buildSteamCatalogRows({
      detailsByAppId: new Map(),
      existingByAppId: new Map([
        [42, {
          steam_app_id: 42,
          image_url: "https://shared.fastly.steamstatic.com/game.jpg",
          release_date: "2026-08-14",
          release_label: "August 14",
          tags: ["Action", "RPG"],
        }],
      ]),
      ledger: {
        42: {
          name: "Preserved Game",
          state: "upcoming",
          preRelease: { rank: 7, estimate: "100K" },
        },
      },
      now: "2026-07-31T12:00:00.000Z",
      sourceUpdatedAt: "2026-07-31T11:00:00.000Z",
    });

    expect(row).toMatchObject({
      release_date: "2026-08-14",
      release_label: "August 14",
      tags: ["Action", "RPG"],
      wishlist_rank: 7,
    });
  });

  it("does not turn a year-only wishlist date into January 1", () => {
    const [row] = buildSteamCatalogRows({
      detailsByAppId: new Map(),
      ledger: {
        42: {
          name: "Year Only Game",
          state: "upcoming",
          releaseDate: "2026",
          preRelease: { rank: 7 },
        },
      },
      now: "2026-07-31T12:00:00.000Z",
      sourceUpdatedAt: "2026-07-31T11:00:00.000Z",
    });

    expect(row?.release_date).toBeNull();
    expect(row?.release_label).toBe("TBA");
  });
});
