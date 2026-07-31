import 'server-only';
import { createSupabaseClient } from '@/supabase-clients/server';

export const STEAM_LEADERBOARD_METRICS = [
  'all',
  'first_weekend_ccu',
  'first_month_reviews',
  'full_price_us',
] as const;

export type SteamLeaderboardMetric = (typeof STEAM_LEADERBOARD_METRICS)[number];

export type SteamLeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarId: string;
  points: number;
  scoredDays: number;
  resolvedMarkets: number;
  isCurrentUser: boolean;
  isPageMember: boolean;
  totalRows: number;
};

export async function getSteamPointsLeaderboard({
  metric = 'all',
  limit = 25,
  offset = 0,
}: {
  metric?: SteamLeaderboardMetric;
  limit?: number;
  offset?: number;
} = {}): Promise<SteamLeaderboardRow[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('get_steam_points_leaderboard', {
    p_metric_type: metric,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    rank: Number(row.rank_position),
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarId: row.avatar_id,
    points: Number(row.points),
    scoredDays: Number(row.scored_days),
    resolvedMarkets: Number(row.resolved_markets),
    isCurrentUser: row.is_current_user,
    isPageMember: row.is_page_member,
    totalRows: Number(row.total_rows),
  }));
}

export async function getSteamProfilePoints(userId: string) {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('steam_user_leaderboard_stats')
    .select('metric_type,points,scored_days,resolved_markets,rank_position')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    metric: row.metric_type as SteamLeaderboardMetric,
    points: Number(row.points),
    scoredDays: row.scored_days,
    resolvedMarkets: row.resolved_markets,
    rank: Number(row.rank_position),
  }));
}
