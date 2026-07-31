import { describe, expect, it } from "vitest";
import {
  formatSteamReleaseLabel,
  normalizeSteamReleaseDate,
  normalizeSteamReleaseMetadata,
} from "../../../database/supabase/functions/_shared/steam-release-date";
import { parseSteamPopularUpcoming } from "../../../database/supabase/functions/_shared/steam-popular-upcoming";
import dearPassengers from "./fixtures/dear-passengers-appdetails.json";

describe("normalizeSteamReleaseDate", () => {
  it.each([
    ["Jul 31, 2026", "2026-07-31"],
    ["31 Jul, 2026", "2026-07-31"],
    ["2026-07-31", "2026-07-31"],
  ])("accepts a complete Steam date %s", (value, expected) => {
    expect(normalizeSteamReleaseDate(value)).toBe(expected);
  });

  it.each(["2026", "July 2026", "Q3 2026", "Coming soon", "To be announced", ""])(
    "never coerces an incomplete Steam date to a calendar day: %s",
    (value) => {
      expect(normalizeSteamReleaseDate(value)).toBeNull();
      expect(formatSteamReleaseLabel(normalizeSteamReleaseDate(value))).toBe("TBA");
    },
  );

  it("rejects impossible calendar dates", () => {
    expect(normalizeSteamReleaseDate("February 31, 2026")).toBeNull();
    expect(normalizeSteamReleaseMetadata("February 31, 2026").invalid).toBe(true);
  });

  it.each([
    ["July 2026", "month", "July 2026"],
    ["Q3 2026", "quarter", "Q3 2026"],
    ["2026", "year", "2026"],
    ["Summer 2026", "year", "Summer 2026"],
    ["Coming&nbsp;soon", "tba", "TBA"],
  ])("preserves truthful precision for %s", (value, precision, label) => {
    expect(normalizeSteamReleaseMetadata(value)).toMatchObject({
      exactDate: null,
      precision,
      label,
      invalid: false,
    });
  });

  it("validates leap years in UTC", () => {
    expect(normalizeSteamReleaseDate("February 29, 2028")).toBe("2028-02-29");
    expect(normalizeSteamReleaseDate("February 29, 2027")).toBeNull();
  });

  it("keeps the Dear Passengers 2026 source label out of an exact-date bucket", () => {
    const release = dearPassengers["4534960"].data.release_date;
    expect(release.coming_soon).toBe(true);
    const source = normalizeSteamReleaseMetadata(release.date);
    expect(source).toMatchObject({ exactDate: null, label: "2026", precision: "year" });
    expect(source.exactDate).not.toBe("2026-01-01");
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
