import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractSteamStoreTags,
  normalizeSteamGenres,
} from "../../../database/supabase/functions/_shared/steam-tags";

const fixture = (name: string) => readFileSync(path.resolve(process.cwd(), "src", "lib", "fixtures", name), "utf8");

describe("normalizeSteamGenres", () => {
  it("keeps unique, clean Steam genres in source order", () => {
    expect(
      normalizeSteamGenres([
        { description: " Action " },
        { description: "RPG" },
        { description: "Action" },
        { description: "Singleplayer" },
      ]),
    ).toEqual(["Action", "RPG", "Singleplayer"]);
  });

  it("ignores malformed genres and caps the visible payload", () => {
    expect(
      normalizeSteamGenres([
        null,
        { description: 42 },
        ...Array.from({ length: 8 }, (_, index) => ({ description: `Genre ${index + 1}` })),
      ]),
    ).toEqual(["Genre 1", "Genre 2", "Genre 3", "Genre 4", "Genre 5"]);
  });
});

describe("extractSteamStoreTags", () => {
  it("reads the first five ordered Store tags, decodes entities, and deduplicates", () => {
    expect(extractSteamStoreTags(fixture("steam-store-tags.html"))).toEqual({
      outcome: "tags",
      tags: ["Online Co-Op", "Multiplayer", "Funny", "Co-op", "Comedy"],
    });
  });

  it("distinguishes an age gate from a genuine no-tag page", () => {
    expect(extractSteamStoreTags(fixture("steam-store-age-gate.html"))).toEqual({
      outcome: "age_gate",
      tags: [],
    });
    expect(extractSteamStoreTags(fixture("steam-store-no-tags.html"))).toEqual({
      outcome: "no_tags",
      tags: [],
    });
  });
});
