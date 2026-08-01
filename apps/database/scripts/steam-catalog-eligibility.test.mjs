import assert from "node:assert/strict";
import test from "node:test";
import {
  getSteamCatalogExclusionReason,
  normalizeSteamAppType,
} from "../supabase/functions/_shared/steam-catalog-eligibility.ts";
import {
  hasReachedSteamReleaseDate,
  isSteamReleaseConfirmed,
} from "../supabase/functions/_shared/steam-release-date.ts";
import { buildSteamCatalogRows } from "../supabase/functions/sync-steam-catalog/catalog.ts";

const releasedGame = {
  appType: "game",
  released: true,
  releaseDate: "2026-07-29",
  releaseText: "July 29, 2026",
  releasePrecision: "exact",
};

test("normalizes authoritative Steam app types", () => {
  assert.equal(normalizeSteamAppType(" DLC "), "dlc");
  assert.equal(normalizeSteamAppType("Music"), "music");
  assert.equal(normalizeSteamAppType(null), null);
});

test("excludes every Steam type except game", () => {
  for (const appType of ["dlc", "music", "demo", "tool", "video", "hardware"]) {
    assert.equal(getSteamCatalogExclusionReason({ ...releasedGame, appType }), "non_game");
  }
});

test("keeps the July 30 boundary and future games", () => {
  assert.equal(
    getSteamCatalogExclusionReason({ ...releasedGame, releaseDate: "2026-07-30" }),
    null,
  );
  assert.equal(getSteamCatalogExclusionReason({ ...releasedGame, released: false }), null);
});

test("excludes definitely old partial release periods", () => {
  for (const release of [
    { releaseText: "2025", releasePrecision: "year" },
    { releaseText: "June 2026", releasePrecision: "month" },
    { releaseText: "Q2 2026", releasePrecision: "quarter" },
  ]) {
    assert.equal(
      getSteamCatalogExclusionReason({
        ...releasedGame,
        releaseDate: null,
        ...release,
      }),
      "released_before_cutoff",
    );
  }
  assert.equal(
    getSteamCatalogExclusionReason({
      ...releasedGame,
      releaseDate: null,
      releaseText: "July 2026",
      releasePrecision: "month",
    }),
    null,
  );
});

test("catalog builder never reintroduces excluded Steam apps", () => {
  const rows = buildSteamCatalogRows({
    detailsByAppId: new Map(),
    excludedAppIds: new Set([20]),
    ledger: {
      10: { name: "Real Game", state: "upcoming", preRelease: { rank: 1 } },
      20: { name: "Real Game Soundtrack", state: "upcoming", preRelease: { rank: 2 } },
    },
    now: "2026-07-31T00:00:00.000Z",
    sourceUpdatedAt: "2026-07-31T00:00:00.000Z",
  });

  assert.deepEqual(
    rows.map((row) => row.steam_app_id),
    [10],
  );
});

test("rejects contradictory future release signals from Steam", () => {
  assert.equal(isSteamReleaseConfirmed(false, "2027-06-08", "2026-08-01"), false);
  assert.equal(isSteamReleaseConfirmed(false, "2026-07-31", "2026-08-01"), true);
  assert.equal(hasReachedSteamReleaseDate(null, "2026-08-01"), true);
});

test("catalog restores a future-dated released ledger row to upcoming", () => {
  const [row] = buildSteamCatalogRows({
    detailsByAppId: new Map(),
    ledger: {
      4094820: {
        name: "Space Evolver",
        state: "released",
        releaseDate: "2027-06-08",
        preRelease: { rank: 8373, estimate: "10k+" },
      },
    },
    now: "2026-08-01T00:00:00.000Z",
    sourceUpdatedAt: "2026-08-01T00:00:00.000Z",
  });

  assert.equal(row.lifecycle_status, "upcoming");
  assert.equal(row.is_wishlisted, true);
  assert.equal(row.wishlist_rank, 8373);
  assert.equal(row.released_at, null);
});
