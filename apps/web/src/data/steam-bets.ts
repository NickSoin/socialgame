import 'server-only';
import { createSupabaseClient } from '@/supabase-clients/server';
import type {
  SteamBetRow,
  SteamBetTargetKey,
  SteamBetTrend,
} from '@/lib/steam-bets';

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
  const supabase = await createSupabaseClient();
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
