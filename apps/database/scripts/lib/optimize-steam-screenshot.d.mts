export const STEAM_SCREENSHOT_MAX_BYTES: number;
export const STEAM_SCREENSHOT_MAX_WIDTH: number;

export function optimizeSteamScreenshot(
  source: Uint8Array,
  options?: { targetBytes?: number; preferredWidth?: number; minimumWidth?: number },
): Promise<{
  buffer: Uint8Array;
  quality: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}>;
