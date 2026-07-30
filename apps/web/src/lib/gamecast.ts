export const AVATARS = [
  { id: 'steam_blue', label: 'Scout', glyph: 'S', tone: 'cyan' },
  { id: 'neon_purple', label: 'Mage', glyph: 'M', tone: 'violet' },
  { id: 'pixel_green', label: 'Ranger', glyph: 'R', tone: 'lime' },
  { id: 'ember_red', label: 'Titan', glyph: 'T', tone: 'red' },
  { id: 'golden_controller', label: 'Legend', glyph: 'G', tone: 'orange' },
  { id: 'cyber_cat', label: 'Synth', glyph: 'C', tone: 'pink' },
] as const;

export type AvatarId = (typeof AVATARS)[number]['id'];
export type MarketOutcome = 'yes' | 'no';
export type MarketStatus = 'open' | 'closed' | 'resolved' | 'voided';
export type ForecastUnit = 'players' | 'reviews' | 'usd' | 'score';
export type AverageMode = 'raw' | 'weighted';

export type PublicMarket = {
  id: string;
  slug: string;
  steam_app_id: number;
  steam_title: string;
  question: string;
  description: string;
  category: string;
  status: MarketStatus;
  yes_price_bps: number;
  total_volume: number;
  closes_at: string;
  resolved_outcome: MarketOutcome | null;
  header_image_url: string | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_id: AvatarId;
  links: Record<string, string>;
  coin_balance: number;
  total_predictions: number;
  resolved_predictions: number;
  correct_predictions: number;
  total_wagered: number;
  is_admin?: boolean;
};

export type ForecastTarget = {
  id: string;
  key: string;
  label: string;
  unit: ForecastUnit;
  min_value: number;
  max_value: number | null;
  step: number;
  closes_at: string;
  raw_average: number | null;
  weighted_average: number | null;
  prediction_count: number;
  user_value: number | null;
};

export type ForecastGame = Pick<
  PublicMarket,
  'id' | 'slug' | 'steam_app_id' | 'steam_title' | 'description' | 'category' | 'header_image_url' | 'closes_at'
> & {
  targets: ForecastTarget[];
};

export type ForecastLeaderboardEntry = {
  rank: number;
  profile_id: string;
  username: string;
  display_name: string;
  avatar_id: AvatarId;
  accuracy: number;
  prediction_count: number;
};

export type NumericPrediction = {
  id: string;
  target_id: string;
  value: number;
  created_at: string;
  updated_at: string;
  target: {
    label: string;
    unit: ForecastUnit;
    status: 'open' | 'resolved';
    resolved_value: number | null;
    market: {
      slug: string;
      steam_title: string;
      header_image_url: string | null;
    } | null;
  } | null;
};

export type Prediction = {
  id: string;
  market_id: string;
  user_id: string;
  outcome: MarketOutcome;
  stake: number;
  price_bps: number;
  shares: number;
  status: 'open' | 'won' | 'lost' | 'refunded';
  payout: number;
  created_at: string;
  markets?: Pick<
    PublicMarket,
    'slug' | 'question' | 'steam_title' | 'status' | 'resolved_outcome'
  > | null;
};

export function formatCoins(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatForecastValue(value: number | null, unit: ForecastUnit): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (unit === 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (unit === 'score') return `${Math.round(value)}`;
  return new Intl.NumberFormat('en-GB', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

export function forecastUnitLabel(unit: ForecastUnit): string {
  if (unit === 'players') return 'players';
  if (unit === 'reviews') return 'reviews';
  if (unit === 'score') return 'score';
  return 'USD';
}

export function formatClosingDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function getAvatar(avatarId: string) {
  return AVATARS.find((avatar) => avatar.id === avatarId) ?? AVATARS[0];
}
