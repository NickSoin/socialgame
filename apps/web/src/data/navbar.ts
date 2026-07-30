import 'server-only';
import { createSupabaseClient } from '@/supabase-clients/server';

export type NavbarViewer = {
  username: string;
  bets: number;
  wins: number;
} | null;

export async function getNavbarViewer(): Promise<NavbarViewer> {
  const supabase = await createSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [profileResult, betsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('username,correct_predictions')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('steam_bets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (betsResult.error) throw new Error(betsResult.error.message);
  if (!profileResult.data) return null;

  return {
    username: profileResult.data.username,
    bets: betsResult.count ?? 0,
    wins: profileResult.data.correct_predictions,
  };
}
