export const STEAM_BET_TARGET_KEYS = [
  'first_weekend_ccu',
  'first_month_reviews',
  'full_price_us',
] as const;

export type SteamBetTargetKey = (typeof STEAM_BET_TARGET_KEYS)[number];

export type SteamBetTarget = {
  key: SteamBetTargetKey;
  label: string;
  min: number;
  max: number;
  step: number;
  userValue: number | null;
};

export type SteamUpcomingGame = {
  appId: number;
  name: string;
  releaseDate: string;
  releaseLabel: string;
  imageUrl: string;
  targets: SteamBetTarget[];
};

export type SteamBetRow = {
  steam_app_id: number;
  target_key: SteamBetTargetKey;
  value: number;
  created_at: string;
  game_name: string | null;
  release_date: string | null;
  release_label: string | null;
  image_url: string | null;
};

export type SteamBetTrend = {
  steam_app_id: number;
  bet_count: number;
  game_name: string | null;
  release_date: string | null;
  release_label: string | null;
  image_url: string | null;
};

export const STEAM_BET_TARGETS: ReadonlyArray<Omit<SteamBetTarget, 'userValue'>> = [
  {
    key: 'first_weekend_ccu',
    label: 'First weekend top CCU',
    min: 0,
    max: 100_000_000,
    step: 1,
  },
  {
    key: 'first_month_reviews',
    label: 'First month total reviews',
    min: 0,
    max: 100_000_000,
    step: 1,
  },
  {
    key: 'full_price_us',
    label: 'Full price in US',
    min: 0,
    max: 10_000,
    step: 0.01,
  },
];
