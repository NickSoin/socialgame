import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSteamAppDetailsLaunchDiscount,
  parseSteamAppDetailsUsdBasePrice,
  parseSteamCurrentPlayerCount,
  parseSteamDbAllTimePeak,
  parseSteamDbUsdBasePrice,
  parseSteamReviewCount,
} from "../supabase/functions/_shared/steam-market-resolution.ts";

test("reads the all-language all-time Steam review total", () => {
  assert.equal(parseSteamReviewCount({ query_summary: { total_reviews: 12_345 } }), 12_345);
});

test("reads SteamDB all-time peak from the charts summary", () => {
  assert.equal(
    parseSteamDbAllTimePeak("<li><strong>112,947</strong> all-time peak</li>"),
    112_947,
  );
});

test("prefers the non-discounted SteamDB U.S. Dollar price", () => {
  const html = "<tr><td>U.S. Dollar</td><td><del>$29.99</del> $23.99</td></tr>";
  assert.equal(parseSteamDbUsdBasePrice(html), 29.99);
});

test("uses Steam appdetails initial price as a base-price fallback", () => {
  const payload = { "1145350": { success: true, data: { price_overview: { initial: 2999 } } } };
  assert.equal(parseSteamAppDetailsUsdBasePrice(payload, 1_145_350), 29.99);
});

test("reads the official Steam launch discount percentage", () => {
  const payload = {
    "1145350": { success: true, data: { price_overview: { discount_percent: 20 } } },
  };
  assert.equal(parseSteamAppDetailsLaunchDiscount(payload, 1_145_350), 20);
});

test("reads the official Steam current-player observation", () => {
  assert.equal(parseSteamCurrentPlayerCount({ response: { player_count: 4_924, result: 1 } }), 4_924);
});
