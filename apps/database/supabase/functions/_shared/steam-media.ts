const TRUSTED_IMAGE_HOSTS = new Set([
  "shared.fastly.steamstatic.com",
  "shared.akamai.steamstatic.com",
  "shared.cloudflare.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "steamcdn-a.akamaihd.net",
]);

export type SteamScreenshot = { position: 1 | 2; sourceUrl: string };

export function trustedSteamImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TRUSTED_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function selectSteamScreenshots(value: unknown): SteamScreenshot[] {
  if (!Array.isArray(value)) return [];
  const selected: SteamScreenshot[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const full = "path_full" in entry ? trustedSteamImageUrl(entry.path_full) : null;
    const thumbnail = "path_thumbnail" in entry ? trustedSteamImageUrl(entry.path_thumbnail) : null;
    const sourceUrl = full ?? thumbnail;
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    selected.push({ position: (selected.length + 1) as 1 | 2, sourceUrl });
    if (selected.length === 2) break;
  }
  return selected;
}
