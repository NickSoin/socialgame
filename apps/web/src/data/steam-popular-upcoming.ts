import { cacheLife, cacheTag } from "next/cache";
import "server-only";
import type { SteamUpcomingGame } from "@/lib/steam-bets";
import { getSteamPopularUpcomingGames } from "@/data/steam-game-catalog";

export async function getSteamPopularUpcoming(): Promise<SteamUpcomingGame[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("steam-popular-upcoming");
  return (await getSteamPopularUpcomingGames()) ?? [];
}
