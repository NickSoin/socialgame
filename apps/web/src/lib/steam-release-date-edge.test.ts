import { describe, expect, it } from "vitest";
import {
  formatSteamReleaseLabel,
  normalizeSteamReleaseDate,
} from "../../../database/supabase/functions/_shared/steam-release-date";
import { parseSteamPopularUpcoming } from "../../../database/supabase/functions/_shared/steam-popular-upcoming";

describe("normalizeSteamReleaseDate", () => {
  it.each([
    ["Jul 31, 2026", "2026-07-31"],
    ["31 Jul, 2026", "2026-07-31"],
    ["2026-07-31", "2026-07-31"],
  ])("accepts a complete Steam date %s", (value, expected) => {
    expect(normalizeSteamReleaseDate(value)).toBe(expected);
  });

  it.each(["2026", "July 2026", "Q3 2026", "Coming soon", "To be announced", ""])(
    "keeps an incomplete Steam date as TBA: %s",
    (value) => {
      expect(normalizeSteamReleaseDate(value)).toBeNull();
      expect(formatSteamReleaseLabel(normalizeSteamReleaseDate(value))).toBe("TBA");
    },
  );

  it("rejects impossible calendar dates", () => {
    expect(normalizeSteamReleaseDate("February 31, 2026")).toBeNull();
  });
});

describe("parseSteamPopularUpcoming", () => {
  it("keeps Steam order and raw incomplete date text for the database refresh", () => {
    const entries = parseSteamPopularUpcoming(`
      <a href="/app/4534960" data-ds-appid="4534960">
        <div class="search_released responsive_secondrow">2026</div>
      </a>
      <a href="/app/1368140" data-ds-appid="1368140">
        <div class="search_released responsive_secondrow">Jul 31, 2026</div>
      </a>
    `);

    expect(entries).toEqual([
      { appId: 4_534_960, position: 1, releaseText: "2026" },
      { appId: 1_368_140, position: 2, releaseText: "Jul 31, 2026" },
    ]);
  });
});
