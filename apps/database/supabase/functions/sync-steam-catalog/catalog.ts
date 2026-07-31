export type WishlistLedgerEntry = {
  name?: unknown;
  state?: unknown;
  preRelease?: {
    rank?: unknown;
    estimate?: unknown;
  } | null;
  releaseDate?: unknown;
};

export type SteamAppDetails = {
  imageUrl: string;
  releaseDate: string | null;
  releaseLabel: string;
  released: boolean;
  tags: string[];
};

export type SteamCatalogRow = {
  steam_app_id: number;
  name: string;
  image_url: string;
  release_date: string | null;
  release_label: string;
  lifecycle_status: 'upcoming' | 'released';
  wishlist_rank: number | null;
  wishlist_estimate: string | null;
  pre_release_rank: number | null;
  is_wishlisted: boolean;
  source: 'steam_wishlist_rank_v2';
  source_updated_at: string;
  last_seen_at: string;
  released_at: string | null;
  tags: string[];
};

export type ExistingSteamCatalogRow = Pick<
  SteamCatalogRow,
  'steam_app_id' | 'image_url' | 'release_date' | 'release_label' | 'tags'
>;

const MAX_STEAM_APP_ID = 999_999_999_999;

export function buildSteamCatalogRows({
  detailsByAppId,
  existingByAppId = new Map(),
  ledger,
  now,
  sourceUpdatedAt,
}: {
  detailsByAppId: Map<number, SteamAppDetails>;
  existingByAppId?: Map<number, ExistingSteamCatalogRow>;
  ledger: Record<string, WishlistLedgerEntry>;
  now: string;
  sourceUpdatedAt: string;
}): SteamCatalogRow[] {
  const rows: SteamCatalogRow[] = [];

  for (const [rawAppId, rawEntry] of Object.entries(ledger)) {
    const appId = Number(rawAppId);
    const name = cleanName(rawEntry?.name);
    if (!Number.isInteger(appId) || appId <= 0 || appId > MAX_STEAM_APP_ID || !name) continue;

    const preReleaseRank = cleanRank(rawEntry?.preRelease?.rank);
    const estimate = cleanEstimate(rawEntry?.preRelease?.estimate);
    const details = detailsByAppId.get(appId);
    const existing = existingByAppId.get(appId);
    const ledgerReleased = rawEntry?.state === 'released';
    const released = ledgerReleased || details?.released === true;
    const ledgerReleaseDate = ledgerReleased ? cleanIsoDate(rawEntry?.releaseDate) : null;
    const releaseDate = details
      ? details.releaseDate
      : existing?.release_date ?? ledgerReleaseDate;
    const releaseLabel = details
      ? details.releaseLabel
      : existing?.release_label ?? (releaseDate ? formatReleaseLabel(releaseDate) : 'TBA');

    rows.push({
      steam_app_id: appId,
      name,
      image_url: details?.imageUrl ?? existing?.image_url ?? fallbackHeaderImage(appId),
      release_date: releaseDate,
      release_label: releaseLabel,
      lifecycle_status: released ? 'released' : 'upcoming',
      wishlist_rank: released ? null : preReleaseRank,
      wishlist_estimate: released ? null : estimate,
      pre_release_rank: preReleaseRank,
      is_wishlisted: !released && preReleaseRank !== null,
      source: 'steam_wishlist_rank_v2',
      source_updated_at: sourceUpdatedAt,
      last_seen_at: now,
      released_at: released ? releaseDate ? `${releaseDate}T00:00:00.000Z` : sourceUpdatedAt : null,
      tags: details?.tags ?? existing?.tags ?? [],
    });
  }

  return rows;
}

export function getTopUpcomingAppIds(
  ledger: Record<string, WishlistLedgerEntry>,
  limit: number,
) {
  return Object.entries(ledger)
    .filter(([, entry]) => entry?.state === 'upcoming')
    .map(([appId, entry]) => ({ appId: Number(appId), rank: cleanRank(entry?.preRelease?.rank) }))
    .filter(
      (entry): entry is { appId: number; rank: number } =>
        Number.isInteger(entry.appId) && entry.appId > 0 && entry.rank !== null,
    )
    .sort((left, right) => left.rank - right.rank)
    .slice(0, limit)
    .map((entry) => entry.appId);
}

export function fallbackHeaderImage(appId: number) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

export function formatReleaseLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return 'TBA';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function cleanIsoDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(normalized)
    ? normalized
    : null;
}

function cleanName(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, 250) : null;
}

function cleanRank(value: unknown) {
  const rank = Number(value);
  return Number.isInteger(rank) && rank >= 1 && rank <= 10_000 ? rank : null;
}

function cleanEstimate(value: unknown) {
  if (typeof value !== 'string') return null;
  const estimate = value.trim();
  return estimate ? estimate.slice(0, 24) : null;
}
