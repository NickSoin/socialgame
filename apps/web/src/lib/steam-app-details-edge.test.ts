import { describe, expect, it } from "vitest";
import {
  selectSteamScreenshots,
  trustedSteamImageUrl,
} from "../../../database/supabase/functions/_shared/steam-media";

describe("Steam screenshot discovery", () => {
  it("accepts only trusted HTTPS Steam CDN hosts", () => {
    expect(trustedSteamImageUrl("https://shared.akamai.steamstatic.com/path/image.jpg"))
      .toBe("https://shared.akamai.steamstatic.com/path/image.jpg");
    expect(trustedSteamImageUrl("http://shared.akamai.steamstatic.com/path/image.jpg")).toBeNull();
    expect(trustedSteamImageUrl("https://steamstatic.example.com/path/image.jpg")).toBeNull();
  });

  it("selects the first two distinct valid screenshots deterministically", () => {
    expect(selectSteamScreenshots([
      { path_full: "https://evil.example/one.jpg" },
      { path_full: "https://shared.akamai.steamstatic.com/one.jpg" },
      { path_full: "https://shared.akamai.steamstatic.com/one.jpg" },
      { path_full: "https://shared.fastly.steamstatic.com/two.jpg" },
      { path_full: "https://shared.fastly.steamstatic.com/three.jpg" },
    ])).toEqual([
      { position: 1, sourceUrl: "https://shared.akamai.steamstatic.com/one.jpg" },
      { position: 2, sourceUrl: "https://shared.fastly.steamstatic.com/two.jpg" },
    ]);
  });
});
