import { describe, expect, it } from "vitest";
import {
  buildSteamFeedHref,
  getSteamFeedPageCount,
  paginateSteamFeed,
  STEAM_FEED_PAGE_SIZE,
} from "./steam-feed-pagination";

describe("Steam feed pagination", () => {
  it("returns no more than 12 items for a page", () => {
    const items = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(STEAM_FEED_PAGE_SIZE).toBe(12);
    expect(paginateSteamFeed(items, 1)).toEqual(items.slice(0, 12));
    expect(paginateSteamFeed(items, 3)).toEqual(items.slice(24, 30));
    expect(getSteamFeedPageCount(items.length)).toBe(3);
  });

  it("preserves active filters in feed links without exposing page numbers", () => {
    expect(buildSteamFeedHref({ mode: "upcoming", query: " Half-Life " }))
      .toBe("/?q=Half-Life");
    expect(buildSteamFeedHref({ mode: "involved", status: "resolved" }))
      .toBe("/involved?status=resolved");
    expect(buildSteamFeedHref({ mode: "trending" })).toBe("/trending");
  });
});
