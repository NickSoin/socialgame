export type SteamPopularUpcomingEntry = {
  appId: number;
  position: number;
  releaseText: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSteamPopularUpcoming(resultsHtml: string): SteamPopularUpcomingEntry[] {
  const rows = resultsHtml.matchAll(
    new RegExp('<a\\s+href="[^"]*"[^>]*data-ds-appid="(\\d+)"[^>]*>([\\s\\S]*?)<\\/a>', "gi"),
  );
  const entries: Omit<SteamPopularUpcomingEntry, "position">[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    const appId = Number(row[1]);
    if (!Number.isInteger(appId) || appId <= 0 || seen.has(appId)) continue;
    seen.add(appId);
    const body = row[2] ?? "";
    const releaseText = decodeHtml(
      body.match(/<div\s+class="search_released[^"]*">([\s\S]*?)<\/div>/i)?.[1] ?? "",
    );
    entries.push({ appId, releaseText });
  }

  return entries.map((entry, index) => ({ ...entry, position: index + 1 }));
}
