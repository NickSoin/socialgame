import { describe, expect, it } from "vitest";
import {
  buildSteamFeedPageHref,
  getSteamFeedPageCount,
  paginateSteamFeed,
  parseSteamFeedPage,
  STEAM_FEED_PAGE_SIZE,
} from "./steam-feed-pagination";

describe("Steam feed pagination", () => {
  it("uses a safe one-based page number", () => {
    expect(parseSteamFeedPage(undefined)).toBe(1);
    expect(parseSteamFeedPage("2")).toBe(2);
    expect(parseSteamFeedPage("0")).toBe(1);
    expect(parseSteamFeedPage("2.5")).toBe(1);
    expect(parseSteamFeedPage("invalid")).toBe(1);
  });

  it("returns no more than 12 items for a page", () => {
    const items = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(STEAM_FEED_PAGE_SIZE).toBe(12);
    expect(paginateSteamFeed(items, 1)).toEqual(items.slice(0, 12));
    expect(paginateSteamFeed(items, 3)).toEqual(items.slice(24, 30));
    expect(getSteamFeedPageCount(items.length)).toBe(3);
  });

  it("preserves active filters in page links", () => {
    expect(buildSteamFeedPageHref({ mode: "upcoming", page: 2, query: " Half-Life " }))
      .toBe("/?q=Half-Life&page=2");
    expect(buildSteamFeedPageHref({ mode: "involved", page: 3, status: "resolved" }))
      .toBe("/involved?status=resolved&page=3");
    expect(buildSteamFeedPageHref({ mode: "trending", page: 1 })).toBe("/trending");
  });
});
