import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  optimizeSteamScreenshot,
  STEAM_SCREENSHOT_MAX_BYTES,
} from "../../../database/scripts/lib/optimize-steam-screenshot.mjs";

describe("Steam screenshot optimizer", () => {
  it("emits a bounded WebP without upscaling or changing aspect ratio", async () => {
    const source = await readFile(path.resolve(process.cwd(), "public", "game-previews", "1368140-1.webp"));
    const sourceMetadata = await sharp(source).metadata();
    const result = await optimizeSteamScreenshot(source);
    const outputMetadata = await sharp(result.buffer).metadata();

    expect(result.buffer.length).toBeLessThanOrEqual(STEAM_SCREENSHOT_MAX_BYTES);
    expect(outputMetadata.format).toBe("webp");
    expect(outputMetadata.width).toBeLessThanOrEqual(Math.min(sourceMetadata.width!, 540));
    expect(outputMetadata.width! / outputMetadata.height!).toBeCloseTo(
      sourceMetadata.width! / sourceMetadata.height!,
      2,
    );
  });
});
