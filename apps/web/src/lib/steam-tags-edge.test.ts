import { describe, expect, it } from "vitest";
import { normalizeSteamGenres } from "../../../database/supabase/functions/_shared/steam-tags";

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
