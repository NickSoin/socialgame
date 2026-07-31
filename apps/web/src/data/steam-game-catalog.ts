import { createClient } from "@supabase/supabase-js";
import "server-only";
import type { Database } from "@/lib/database.types";
import type { SteamUpcomingGame } from "@/lib/steam-bets";
import { toSteamUpcomingGame } from "@/lib/steam-game-catalog";

const CATALOG_FIELDS =
  "steam_app_id,name,image_url,release_date,release_label,tags,wishlist_rank" as const;

function createPublicCatalogClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getSteamCatalogGames(limit = 200): Promise<SteamUpcomingGame[] | null> {
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS)
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)
    .order("wishlist_rank", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Could not load the Steam wishlist catalog.", error);
    return null;
  }

  return (data ?? []).map(toSteamUpcomingGame);
}

export async function getSteamPopularUpcomingGames(
  limit = 200,
): Promise<SteamUpcomingGame[] | null> {
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS)
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)
    .eq("is_popular_upcoming", true)
    .order("release_date", { ascending: true, nullsFirst: false })
    .order("wishlist_rank", { ascending: true, nullsFirst: false })
    .order("popular_upcoming_position", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    console.error("Could not load the stored Steam popular upcoming catalog.", error);
    return null;
  }

  return (data ?? []).map(toSteamUpcomingGame);
}

export async function getSteamCatalogGamesByIds(appIds: number[]) {
  const uniqueAppIds = [...new Set(appIds)].filter(Number.isInteger).slice(0, 500);
  if (!uniqueAppIds.length) return [];

  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS)
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)
    .in("steam_app_id", uniqueAppIds);

  if (error) {
    console.error("Could not load games from the Steam wishlist catalog.", error);
    return [];
  }

  return (data ?? []).map(toSteamUpcomingGame);
}

export async function searchSteamCatalogGames(
  query: string,
  limit = 20,
): Promise<SteamUpcomingGame[]> {
  const normalizedQuery = query.trim().slice(0, 80);
  if (!normalizedQuery) return [];

  const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS)
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)
    .ilike("name", `%${escapedQuery}%`)
    .order("wishlist_rank", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) {
    console.error("Could not search the Steam wishlist catalog.", error);
    return [];
  }

  return (data ?? []).map(toSteamUpcomingGame);
}

export async function getSteamWishlistRanks(appIds: number[]) {
  const uniqueAppIds = [...new Set(appIds)].filter(Number.isInteger);
  if (!uniqueAppIds.length) return new Map<number, number>();

  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("steam_games")
    .select("steam_app_id,wishlist_rank")
    .eq("is_wishlisted", true)
    .in("steam_app_id", uniqueAppIds);

  if (error) {
    console.error("Could not load Steam wishlist ranks.", error);
    return new Map<number, number>();
  }

  return new Map(
    (data ?? []).flatMap((row) =>
      row.wishlist_rank === null ? [] : [[Number(row.steam_app_id), row.wishlist_rank] as const],
    ),
  );
}

export async function getOpenSteamCatalogGame(steamAppId: number): Promise<{
  catalogAvailable: boolean;
  game: SteamUpcomingGame | null;
}> {
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS)
    .eq("steam_app_id", steamAppId)
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)
    .maybeSingle();

  if (error) {
    console.error("Could not validate the Steam catalog game.", error);
    return { catalogAvailable: false, game: null };
  }

  return {
    catalogAvailable: true,
    game: data ? toSteamUpcomingGame(data) : null,
  };
}
