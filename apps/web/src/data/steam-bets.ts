import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/supabase-clients/server';
import type { Database } from '@/lib/database.types';
import type {
  SteamBetRow,
  SteamBetSummary,
  SteamBetTargetKey,
  SteamBetTrend,
} from '@/lib/steam-bets';
import { STEAM_BET_TARGET_KEYS } from '@/lib/steam-bets';

function createPublicSteamStatsClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getCurrentUserSteamBets(): Promise<{
  isAuthenticated: boolean;
  bets: SteamBetRow[];
}> {
  const supabase = await createSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { isAuthenticated: false, bets: [] };

  const { data, error } = await supabase
    .from('steam_bets')
    .select('steam_app_id,target_key,value,created_at,game_name,release_date,release_label,image_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return {
    isAuthenticated: true,
    bets: (data ?? []).map((bet) => ({
      steam_app_id: Number(bet.steam_app_id),
      target_key: bet.target_key as SteamBetTargetKey,
      value: Number(bet.value),
      created_at: bet.created_at,
      game_name: bet.game_name,
      release_date: bet.release_date,
      release_label: bet.release_label,
      image_url: bet.image_url,
    })),
  };
}

export async function getSteamBetTrends(): Promise<SteamBetTrend[]> {
  const supabase = createPublicSteamStatsClient();
  const { data, error } = await supabase.rpc('get_steam_bet_trends');
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    steam_app_id: Number(row.steam_app_id),
    bet_count: Number(row.bet_count),
    game_name: row.game_name,
    release_date: row.release_date,
    release_label: row.release_label,
    image_url: row.image_url,
  }));
}

export async function getSteamBetSummaries(): Promise<SteamBetSummary[]> {
  const supabase = createPublicSteamStatsClient();
  const { data, error } = await supabase.rpc('get_steam_bet_summaries');
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const targetKey = row.target_key as SteamBetTargetKey;
    if (!STEAM_BET_TARGET_KEYS.includes(targetKey)) return [];

    return [{
      steam_app_id: Number(row.steam_app_id),
      target_key: targetKey,
      average_value: Number(row.average_value),
      prediction_count: Number(row.prediction_count),
    }];
  });
}
