import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimizeSteamScreenshot } from "../../database/scripts/lib/optimize-steam-screenshot.mjs";

const previewDirectory = path.resolve(process.env.GAME_PREVIEW_DIRECTORY ?? "public/game-previews");
const targetBytes = Number(process.env.GAME_PREVIEW_MAX_BYTES ?? 25 * 1024);
const preferredWidth = Number(process.env.GAME_PREVIEW_MAX_WIDTH ?? 540);

if (!Number.isInteger(targetBytes) || targetBytes < 5 * 1024) {
  throw new Error("GAME_PREVIEW_MAX_BYTES must be an integer of at least 5120 bytes.");
}

const files = (await readdir(previewDirectory))
  .filter((file) => file.toLowerCase().endsWith(".webp"))
  .sort();

for (const file of files) {
  const filePath = path.join(previewDirectory, file);
  const before = await stat(filePath);
  const source = await readFile(filePath);
  const selected = await optimizeSteamScreenshot(source, { targetBytes, preferredWidth });
  if (selected.buffer.length < before.size || before.size > targetBytes) {
    await writeFile(filePath, selected.buffer);
  }
  console.log(
    `${file}: ${(before.size / 1024).toFixed(1)} KB -> ${(selected.buffer.length / 1024).toFixed(1)} KB `
    + `(${selected.width}x${selected.height}, WebP q${selected.quality})`,
  );
}
