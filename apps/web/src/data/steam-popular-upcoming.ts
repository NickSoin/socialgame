import { cacheLife, cacheTag } from 'next/cache';
import 'server-only';
import type { SteamUpcomingGame } from '@/lib/steam-bets';
import { parseSteamPopularUpcoming } from '@/lib/parse-steam-popular-upcoming';

const STEAM_POPULAR_UPCOMING_URL =
  'https://store.steampowered.com/search/results/?query&start=0&count=20&dynamic_data=&sort_by=_ASC&filter=popularcomingsoon&snr=1_7_7_popularcomingsoon_7&infinite=1&l=english&cc=us';

export async function getSteamPopularUpcoming(): Promise<SteamUpcomingGame[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('steam-popular-upcoming');

  const response = await fetch(STEAM_POPULAR_UPCOMING_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NextHitMarket/1.0 (+Steam game forecasting)',
    },
  });

  if (!response.ok) {
    throw new Error(`Steam returned ${response.status}`);
  }

  const payload = (await response.json()) as { results_html?: string };
  const games = parseSteamPopularUpcoming(payload.results_html ?? '');
  if (!games.length) throw new Error('Steam returned no popular upcoming games');
  return games;
}
