import 'server-only';
import { createSupabaseClient } from '@/supabase-clients/server';
import type { Tables } from '@/lib/database.types';
import type {
  ForecastGame,
  ForecastLeaderboardEntry,
  ForecastTarget,
  ForecastUnit,
  NumericPrediction,
  Prediction,
  PublicMarket,
  PublicProfile,
} from '@/lib/gamecast';

type MarketRow = Tables<'markets'>;
type ProfileRow = Tables<'profiles'>;
type PredictionRow = Tables<'predictions'>;

function mapMarket(row: MarketRow): PublicMarket {
  return {
    id: row.id,
    slug: row.slug,
    steam_app_id: row.steam_app_id,
    steam_title: row.steam_title,
    question: row.question,
    description: row.description,
    category: row.category,
    status: row.status,
    yes_price_bps: row.yes_price_bps,
    total_volume: Number(row.total_volume),
    closes_at: row.closes_at,
    resolved_outcome: row.resolved_outcome,
    header_image_url: row.header_image_url,
  };
}

function mapProfile(row: ProfileRow): PublicProfile {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    bio: row.bio,
    avatar_id: row.avatar_id,
    links: (row.links ?? {}) as Record<string, string>,
    coin_balance: Number(row.coin_balance),
    total_predictions: row.predictions_made,
    resolved_predictions: row.predictions_resolved,
    correct_predictions: row.correct_predictions,
    total_wagered: Number(row.coins_wagered),
    is_admin: false,
  };
}

export async function getPublicMarkets({
  limit = 30,
  status,
}: {
  limit?: number;
  status?: 'open' | 'resolved';
} = {}): Promise<PublicMarket[]> {
  const supabase = await createSupabaseClient();
  let query = supabase
    .from('markets')
    .select('*')
    .order('status', { ascending: true })
    .order('closes_at', { ascending: true })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load markets: ${error.message}`);
  return (data ?? []).map(mapMarket);
}

export async function getMarketBySlug(
  slug: string,
): Promise<PublicMarket | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`Could not load market: ${error.message}`);
  return data ? mapMarket(data) : null;
}

export async function getProfileByUsername(
  username: string,
): Promise<PublicProfile | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return data ? mapProfile(data) : null;
}

export async function getCurrentUserContext() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const [{ data, error }, { data: isAdmin, error: adminError }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.rpc('is_current_user_admin'),
    ]);

  if (error || adminError) {
    throw new Error(
      `Could not load your profile: ${error?.message ?? adminError?.message}`,
    );
  }
  return {
    user,
    profile: data ? { ...mapProfile(data), is_admin: Boolean(isAdmin) } : null,
  };
}

export async function getCurrentUserPredictions(): Promise<Prediction[]> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('predictions')
    .select(
      '*, markets(slug, question, steam_title, status, resolved_outcome)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load predictions: ${error.message}`);

  return (data ?? []).map((row) => {
    const typedRow = row as PredictionRow & {
      markets: Prediction['markets'];
    };
    return {
      id: typedRow.id,
      market_id: typedRow.market_id,
      user_id: typedRow.user_id,
      outcome: typedRow.outcome,
      stake: typedRow.stake,
      price_bps: typedRow.price_bps,
      shares: Number(typedRow.shares),
      status:
        typedRow.is_correct === null
          ? 'open'
          : typedRow.is_correct
            ? 'won'
            : 'lost',
      payout: Number(typedRow.payout),
      created_at: typedRow.created_at,
      markets: typedRow.markets,
    };
  });
}

export async function getLeaderboardProfiles(): Promise<{
  byCoins: PublicProfile[];
  byAccuracy: PublicProfile[];
}> {
  const supabase = await createSupabaseClient();
  const [{ data: coinRows, error: coinError }, { data: profileRows, error }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('coin_balance', { ascending: false })
        .limit(20),
      supabase
        .from('profiles')
        .select('*')
        .gt('predictions_resolved', 0)
        .limit(100),
    ]);

  if (coinError || error) {
    throw new Error(
      `Could not load leaderboards: ${coinError?.message ?? error?.message}`,
    );
  }

  const byAccuracy = (profileRows ?? [])
    .map(mapProfile)
    .sort((a, b) => {
      const aRate =
        a.correct_predictions / Math.max(a.resolved_predictions, 1);
      const bRate =
        b.correct_predictions / Math.max(b.resolved_predictions, 1);
      return bRate - aRate || b.correct_predictions - a.correct_predictions;
    })
    .slice(0, 20);

  return {
    byCoins: (coinRows ?? []).map(mapProfile),
    byAccuracy,
  };
}

export async function getForecastGames({
  slug,
  limit = 30,
}: {
  slug?: string;
  limit?: number;
} = {}): Promise<ForecastGame[]> {
  const supabase = await createSupabaseClient();
  let marketQuery = supabase
    .from('markets')
    .select('*')
    .eq('status', 'open')
    .order('closes_at', { ascending: true })
    .limit(limit);
  if (slug) marketQuery = marketQuery.eq('slug', slug);

  const { data: marketRows, error: marketError } = await marketQuery;
  if (marketError) throw new Error(`Could not load games: ${marketError.message}`);
  if (!marketRows?.length) return [];

  const marketIds = marketRows.map((market) => market.id);
  const { data: targetRows, error: targetError } = await supabase
    .from('forecast_targets')
    .select('*')
    .in('market_id', marketIds)
    .eq('status', 'open')
    .order('display_order', { ascending: true });
  if (targetError) throw new Error(`Could not load forecast targets: ${targetError.message}`);

  const targetIds = (targetRows ?? []).map((target) => target.id);
  const [summaryResult, userResult] = await Promise.all([
    supabase.rpc('get_forecast_summaries', { p_market_ids: marketIds }),
    supabase.auth.getUser(),
  ]);
  if (summaryResult.error) {
    throw new Error(`Could not load forecast averages: ${summaryResult.error.message}`);
  }

  const userId = userResult.data.user?.id;
  let ownRows: { target_id: string; value: number }[] = [];
  if (userId && targetIds.length) {
    const ownResult = await supabase
      .from('numeric_predictions')
      .select('target_id, value')
      .eq('user_id', userId)
      .in('target_id', targetIds);
    if (ownResult.error) {
      throw new Error(`Could not load your forecasts: ${ownResult.error.message}`);
    }
    ownRows = ownResult.data ?? [];
  }

  const summaries = new Map(
    (summaryResult.data ?? []).map((summary) => [summary.target_id, summary]),
  );
  const ownValues = new Map(
    ownRows.map((prediction): [string, number] => [prediction.target_id, Number(prediction.value)]),
  );

  return marketRows.map((row) => {
    const market = mapMarket(row);
    const targets: ForecastTarget[] = (targetRows ?? [])
      .filter((target) => target.market_id === row.id)
      .map((target) => {
        const summary = summaries.get(target.id);
        return {
          id: target.id,
          key: target.key,
          label: target.label,
          unit: target.unit as ForecastUnit,
          min_value: Number(target.min_value),
          max_value: target.max_value === null ? null : Number(target.max_value),
          step: Number(target.step),
          closes_at: target.closes_at,
          raw_average: summary?.raw_average == null ? null : Number(summary.raw_average),
          weighted_average:
            summary?.weighted_average == null ? null : Number(summary.weighted_average),
          prediction_count: Number(summary?.prediction_count ?? 0),
          user_value: ownValues.get(target.id) ?? null,
        };
      });

    return {
      id: market.id,
      slug: market.slug,
      steam_app_id: market.steam_app_id,
      steam_title: market.steam_title,
      description: market.description,
      category: market.category,
      header_image_url: market.header_image_url,
      closes_at: market.closes_at,
      targets,
    };
  });
}

export async function getGameForecastBySlug(slug: string): Promise<ForecastGame | null> {
  const games = await getForecastGames({ slug, limit: 1 });
  return games[0] ?? null;
}

export async function getForecastLeaderboard(
  period: 'day' | 'week' | 'month',
): Promise<ForecastLeaderboardEntry[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('get_forecast_leaderboard', {
    p_period: period,
  });
  if (error) throw new Error(`Could not load forecast leaderboard: ${error.message}`);
  return (data ?? []).map((entry) => ({
    rank: Number(entry.rank),
    profile_id: entry.profile_id,
    username: entry.username,
    display_name: entry.display_name,
    avatar_id: entry.avatar_id,
    accuracy: Number(entry.accuracy),
    prediction_count: Number(entry.prediction_count),
  }));
}

export async function getCurrentUserNumericPredictions(): Promise<NumericPrediction[]> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('numeric_predictions')
    .select(
      'id, target_id, value, created_at, updated_at, forecast_targets(label, unit, status, resolved_value, markets(slug, steam_title, header_image_url))',
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Could not load your forecasts: ${error.message}`);

  return (data ?? []).map((row) => {
    const target = row.forecast_targets as {
      label: string;
      unit: string;
      status: 'open' | 'resolved';
      resolved_value: number | null;
      markets: {
        slug: string;
        steam_title: string;
        header_image_url: string | null;
      } | null;
    } | null;
    return {
      id: row.id,
      target_id: row.target_id,
      value: Number(row.value),
      created_at: row.created_at,
      updated_at: row.updated_at,
      target: target
        ? {
            label: target.label,
            unit: target.unit as ForecastUnit,
            status: target.status,
            resolved_value:
              target.resolved_value === null ? null : Number(target.resolved_value),
            market: target.markets,
          }
        : null,
    };
  });
}
