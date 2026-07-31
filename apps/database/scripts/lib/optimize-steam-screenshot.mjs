import sharp from "sharp";

export const STEAM_SCREENSHOT_MAX_BYTES = 25 * 1024;
export const STEAM_SCREENSHOT_MAX_WIDTH = 540;

export async function optimizeSteamScreenshot(source, options = {}) {
  const targetBytes = options.targetBytes ?? STEAM_SCREENSHOT_MAX_BYTES;
  const preferredWidth = options.preferredWidth ?? STEAM_SCREENSHOT_MAX_WIDTH;
  const minimumWidth = options.minimumWidth ?? 240;
  const metadata = await sharp(source, { failOn: "warning" }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Source image dimensions are unavailable.");

  const startingWidth = Math.min(metadata.width, preferredWidth);
  for (let width = startingWidth; width >= Math.min(minimumWidth, startingWidth); width -= 40) {
    let lowerQuality = 18;
    let upperQuality = 94;
    let bestAtWidth = null;
    while (lowerQuality <= upperQuality) {
      const quality = Math.floor((lowerQuality + upperQuality) / 2);
      const buffer = await sharp(source, { failOn: "warning" })
        .rotate()
        .resize({ width, fit: "inside", withoutEnlargement: true })
        .webp({ effort: 6, preset: "picture", quality, smartSubsample: true })
        .toBuffer();
      if (buffer.length <= targetBytes) {
        bestAtWidth = { buffer, quality };
        lowerQuality = quality + 1;
      } else {
        upperQuality = quality - 1;
      }
    }
    if (bestAtWidth) {
      const output = await sharp(bestAtWidth.buffer).metadata();
      if (!output.width || !output.height || output.format !== "webp") {
        throw new Error("Optimized screenshot validation failed.");
      }
      return {
        ...bestAtWidth,
        width: output.width,
        height: output.height,
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
      };
    }
  }
  throw new Error(`Could not reach the ${targetBytes} byte screenshot budget.`);
}
