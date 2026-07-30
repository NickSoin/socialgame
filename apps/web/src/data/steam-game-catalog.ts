import { createClient } from '@supabase/supabase-js';
import 'server-only';
import type { Database } from '@/lib/database.types';
import type { SteamUpcomingGame } from '@/lib/steam-bets';
import { toSteamUpcomingGame } from '@/lib/steam-game-catalog';

const CATALOG_FIELDS =
  'steam_app_id,name,image_url,release_date,release_label' as const;

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
    .from('steam_games')
    .select(CATALOG_FIELDS)
    .eq('lifecycle_status', 'upcoming')
    .eq('is_wishlisted', true)
    .order('wishlist_rank', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Could not load the Steam wishlist catalog.', error);
    return null;
  }

  return (data ?? []).map(toSteamUpcomingGame);
}

export async function getOpenSteamCatalogGame(steamAppId: number): Promise<{
  catalogAvailable: boolean;
  game: SteamUpcomingGame | null;
}> {
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from('steam_games')
    .select(CATALOG_FIELDS)
    .eq('steam_app_id', steamAppId)
    .eq('lifecycle_status', 'upcoming')
    .eq('is_wishlisted', true)
    .maybeSingle();

  if (error) {
    console.error('Could not validate the Steam catalog game.', error);
    return { catalogAvailable: false, game: null };
  }

  return {
    catalogAvailable: true,
    game: data ? toSteamUpcomingGame(data) : null,
  };
}
