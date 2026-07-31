import { cacheLife, cacheTag } from "next/cache";
import "server-only";
import type { SteamUpcomingGame } from "@/lib/steam-bets";
import {
  getSteamPopularUpcomingGames,
  type SteamCatalogPage,
} from "@/data/steam-game-catalog";

export async function getSteamPopularUpcoming({
  limit = 12,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}): Promise<SteamCatalogPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag("steam-popular-upcoming");
  return (await getSteamPopularUpcomingGames({ limit, offset })) ?? {
    games: [] as SteamUpcomingGame[],
    total: 0,
  };
}
