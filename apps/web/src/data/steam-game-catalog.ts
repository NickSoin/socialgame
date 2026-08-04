import { createClient } from "@supabase/supabase-js";
import "server-only";
import type { Database } from "@/lib/database.types";
import type { SteamUpcomingGame } from "@/lib/steam-bets";
import { toSteamUpcomingGame } from "@/lib/steam-game-catalog";

const CATALOG_FIELDS =
  "steam_app_id,name,image_url,release_date,release_label,release_precision,tags,lifecycle_status,is_wishlisted,wishlist_rank,pre_release_rank,source_updated_at,follower_count,followers_updated_at,average_forecast_history,steam_game_media(kind,position,storage_bucket,storage_path,active)" as const;

export type SteamCatalogPage = {
  games: SteamUpcomingGame[];
  total: number;
};

type SteamCatalogPageOptions = {
  limit?: number;
  offset?: number;
};

function getPageRange({ limit = 12, offset = 0 }: SteamCatalogPageOptions) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const safeOffset = Math.max(Math.trunc(offset), 0);
  return { from: safeOffset, to: safeOffset + safeLimit - 1 };
}

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
  options: SteamCatalogPageOptions = {},
): Promise<SteamCatalogPage | null> {
  const { from, to } = getPageRange(options);
  const supabase = createPublicCatalogClient();
  const { data, error, count } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS, { count: "exact" })
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)
    .eq("is_popular_upcoming", true)
    .order("release_date", { ascending: true, nullsFirst: false })
    .order("wishlist_rank", { ascending: true, nullsFirst: false })
    .order("popular_upcoming_position", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Could not load the stored Steam popular upcoming catalog.", error);
    return null;
  }

  const games = (data ?? []).map(toSteamUpcomingGame);
  return { games, total: count ?? games.length };
}

export async function getSteamReleasedGamesPage(
  lifecycle: "locked" | "completed",
  query = "",
  options: SteamCatalogPageOptions = {},
): Promise<SteamCatalogPage> {
  const normalizedQuery = query.trim().slice(0, 80);
  const { from, to } = getPageRange(options);
  const limit = to - from + 1;
  const supabase = createPublicCatalogClient();
  const { data: feedRows, error: feedError } = await supabase.rpc(
    "get_steam_released_game_feed",
    { p_lifecycle: lifecycle, p_query: normalizedQuery, p_limit: limit, p_offset: from },
  );

  if (feedError) {
    console.error(`Could not load ${lifecycle} Steam games.`, feedError);
    return { games: [], total: 0 };
  }

  const appIds = (feedRows ?? []).map((row) => Number(row.steam_app_id));
  const total = Number(feedRows?.[0]?.total_rows ?? 0);
  if (!appIds.length) return { games: [], total };

  const { data, error } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS)
    .in("steam_app_id", appIds);
  if (error) {
    console.error(`Could not hydrate ${lifecycle} Steam games.`, error);
    return { games: [], total: 0 };
  }

  const gamesById = new Map((data ?? []).map((row) => [Number(row.steam_app_id), toSteamUpcomingGame(row)]));
  return { games: appIds.flatMap((appId) => gamesById.get(appId) ?? []), total };
}

export async function getSteamCompletedGamesPage(
  query = "",
  options: SteamCatalogPageOptions = {},
): Promise<SteamCatalogPage> {
  return getSteamReleasedGamesPage("completed", query, options);
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

export async function getSteamCatalogGamesByIdsAnyLifecycle(appIds: number[]) {
  const uniqueAppIds = [...new Set(appIds)].filter(Number.isInteger).slice(0, 500);
  if (!uniqueAppIds.length) return [];

  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS)
    .in("steam_app_id", uniqueAppIds);

  if (error) {
    console.error("Could not load staging games from the Steam wishlist catalog.", error);
    return [];
  }

  return (data ?? [])
    .filter((row) => row.lifecycle_status === "upcoming"
      ? row.is_wishlisted
      : row.pre_release_rank !== null)
    .map(toSteamUpcomingGame);
}

export async function searchSteamCatalogGames(
  query: string,
  limit = 20,
): Promise<SteamUpcomingGame[]> {
  return (await searchSteamCatalogGamesPage(query, { limit })).games;
}

export async function searchSteamCatalogGamesPage(
  query: string,
  options: SteamCatalogPageOptions = {},
): Promise<SteamCatalogPage> {
  const normalizedQuery = query.trim().slice(0, 80);
  if (!normalizedQuery) return { games: [], total: 0 };

  const { from, to } = getPageRange(options);
  const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
  const supabase = createPublicCatalogClient();
  const { data, error, count } = await supabase
    .from("steam_games")
    .select(CATALOG_FIELDS, { count: "exact" })
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)
    .ilike("name", `%${escapedQuery}%`)
    .order("wishlist_rank", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Could not search the Steam wishlist catalog.", error);
    return { games: [], total: 0 };
  }

  const games = (data ?? []).map(toSteamUpcomingGame);
  return { games, total: count ?? games.length };
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
