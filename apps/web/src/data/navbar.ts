import 'server-only';
import { createSupabaseClient } from '@/supabase-clients/server';

export type NavbarViewer = {
  username: string;
  bets: number;
  points: number;
} | null;

export async function getNavbarViewer(): Promise<NavbarViewer> {
  const supabase = await createSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [profileResult, betsResult, pointsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('steam_bets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('steam_user_leaderboard_stats')
      .select('points')
      .eq('user_id', userId)
      .eq('metric_type', 'all')
      .maybeSingle(),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (betsResult.error) throw new Error(betsResult.error.message);
  if (pointsResult.error) throw new Error(pointsResult.error.message);
  if (!profileResult.data) return null;

  return {
    username: profileResult.data.username,
    bets: betsResult.count ?? 0,
    points: Number(pointsResult.data?.points ?? 0),
  };
}
