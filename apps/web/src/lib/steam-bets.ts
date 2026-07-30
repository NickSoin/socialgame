export const STEAM_BET_TARGET_KEYS = [
  'first_weekend_ccu',
  'first_month_reviews',
  'full_price_us',
] as const;

export type SteamBetTargetKey = (typeof STEAM_BET_TARGET_KEYS)[number];

export type SteamBetTarget = {
  key: SteamBetTargetKey;
  label: string;
  maxLength: number;
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

export const STEAM_BET_INPUT_LIMITS = {
  first_weekend_ccu: 7,
  first_month_reviews: 6,
  full_price_us: 7,
} as const satisfies Record<SteamBetTargetKey, number>;

export function sanitizeSteamBetDraft(
  targetKey: SteamBetTargetKey,
  rawValue: string,
) {
  const maxLength = STEAM_BET_INPUT_LIMITS[targetKey];

  if (targetKey !== 'full_price_us') {
    return rawValue.replace(/\D/g, '').slice(0, maxLength);
  }

  const normalized = rawValue.replace(',', '.').replace(/[^\d.]/g, '');
  const dotIndex = normalized.indexOf('.');
  const valueWithOneDecimalPoint = dotIndex === -1
    ? normalized
    : `${normalized.slice(0, dotIndex + 1)}${normalized.slice(dotIndex + 1).replace(/\./g, '')}`;

  return valueWithOneDecimalPoint.slice(0, maxLength);
}

export function parseSteamBetDraft(
  targetKey: SteamBetTargetKey,
  rawValue: string,
) {
  const normalized = rawValue.trim().replace(',', '.');
  const maxLength = STEAM_BET_INPUT_LIMITS[targetKey];
  const pattern = targetKey === 'full_price_us'
    ? /^\d+(?:\.\d+)?$/
    : /^\d+$/;

  if (!normalized || normalized.length > maxLength || !pattern.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  const target = STEAM_BET_TARGETS.find((candidate) => candidate.key === targetKey);

  if (!target || !Number.isFinite(value) || value < target.min || value > target.max) {
    return null;
  }

  return value;
}

export const STEAM_BET_TARGETS: ReadonlyArray<Omit<SteamBetTarget, 'userValue'>> = [
  {
    key: 'first_weekend_ccu',
    label: 'First weekend top CCU',
    maxLength: STEAM_BET_INPUT_LIMITS.first_weekend_ccu,
    min: 0,
    max: 100_000_000,
    step: 1,
  },
  {
    key: 'first_month_reviews',
    label: 'First month total reviews',
    maxLength: STEAM_BET_INPUT_LIMITS.first_month_reviews,
    min: 0,
    max: 100_000_000,
    step: 1,
  },
  {
    key: 'full_price_us',
    label: 'Full price in US',
    maxLength: STEAM_BET_INPUT_LIMITS.full_price_us,
    min: 0,
    max: 10_000,
    step: 0.01,
  },
];
