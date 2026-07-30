import {
  STEAM_BET_TARGETS,
  type SteamUpcomingGame,
} from './steam-bets';

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&apos;': "'",
    '&#39;': "'",
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
  };

  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|apos|#39|quot|lt|gt);/g, (entity) => entities[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeReleaseDate(value: string) {
  const parsed = new Date(`${value} 00:00:00 UTC`);
  if (Number.isNaN(parsed.valueOf())) {
    return { releaseDate: value, releaseLabel: value };
  }

  return {
    releaseDate: parsed.toISOString(),
    releaseLabel: new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(parsed),
  };
}

export function parseSteamPopularUpcoming(resultsHtml: string): SteamUpcomingGame[] {
  const rows = resultsHtml.matchAll(
    new RegExp(
      '<a\\s+href="[^"]*"[^>]*data-ds-appid="(\\d+)"[^>]*>([\\s\\S]*?)<\\/a>',
      'gi',
    ),
  );
  const games: SteamUpcomingGame[] = [];

  for (const row of rows) {
    const appId = Number(row[1]);
    const body = row[2] ?? '';
    const name = decodeHtml(body.match(/<span\s+class="title">([\s\S]*?)<\/span>/i)?.[1] ?? '');
    const imageUrl = decodeHtml(
      body.match(/<div\s+class="search_capsule">[\s\S]*?<img\s+src="([^"]+)"/i)?.[1] ?? '',
    );
    const releaseText = decodeHtml(
      body.match(/<div\s+class="search_released[^"]*">([\s\S]*?)<\/div>/i)?.[1] ?? '',
    );

    if (!Number.isInteger(appId) || !name || !imageUrl || !releaseText) continue;
    const { releaseDate, releaseLabel } = normalizeReleaseDate(releaseText);
    games.push({
      appId,
      name,
      imageUrl,
      releaseDate,
      releaseLabel,
      targets: STEAM_BET_TARGETS.map((target) => ({ ...target, userValue: null })),
    });
  }

  return games;
}
