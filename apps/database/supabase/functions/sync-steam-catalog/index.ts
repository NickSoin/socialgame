import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.105.4';
import {
  buildSteamCatalogRows,
  type ExistingSteamCatalogRow,
  type WishlistLedgerEntry,
} from './catalog.ts';
import { authorizeScheduledRequest } from '../_shared/scheduled-auth.ts';

const SOURCE_META_URL =
  'https://nicksoin.github.io/SteamTopWishlistsRank/v2/meta.json';
const SOURCE_CURRENT_BASE_URL =
  'https://nicksoin.github.io/SteamTopWishlistsRank/v2/current';
const SOURCE_LEDGER_URL =
  'https://raw.githubusercontent.com/NickSoin/SteamTopWishlistsRank/main/data/wishlist-ledger.json';
const UPSERT_BATCH_SIZE = 500;
const SHARD_CONCURRENCY = 16;
const RUNNING_LOCK_MS = 20 * 60 * 1000;
const ELIGIBILITY_POLICY_VERSION = 'games-on-or-after-2026-07-30';

type SourceMeta = {
  schemaVersion?: unknown;
  shardCount?: unknown;
  generatedAt?: unknown;
  current?: { entryCount?: unknown };
  released?: { entryCount?: unknown };
};

type CurrentShard = {
  schemaVersion?: unknown;
  kind?: unknown;
  updatedAt?: unknown;
  entries?: Record<string, {
    rank?: unknown;
    estimate?: unknown;
    name?: unknown;
  }>;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const unauthorized = authorizeScheduledRequest(request);
  if (unauthorized) return unauthorized;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Supabase runtime is not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let sourceUpdatedAt: string | null = null;

  try {
    const meta = await fetchJsonWithRetry<SourceMeta>(SOURCE_META_URL);
    if (
      Number(meta.schemaVersion) !== 2 ||
      Number(meta.shardCount) !== 256 ||
      typeof meta.generatedAt !== 'string'
    ) {
      throw new Error('Wishlist feed metadata is invalid');
    }

    sourceUpdatedAt = new Date(meta.generatedAt).toISOString();
    const { data: previousRun, error: previousRunError } = await supabase
      .from('steam_catalog_sync_runs')
      .select('status,started_at,current_count,released_count')
      .eq('source_updated_at', sourceUpdatedAt)
      .maybeSingle();

    if (previousRunError) throw previousRunError;
    if (
      previousRun?.status === 'running' &&
      Date.now() - new Date(previousRun.started_at).valueOf() < RUNNING_LOCK_MS
    ) {
      return Response.json({ status: 'already_running', sourceUpdatedAt }, { status: 202 });
    }

    const startedAt = new Date().toISOString();
    const { error: runStartError } = await supabase
      .from('steam_catalog_sync_runs')
      .upsert(
        {
          source_updated_at: sourceUpdatedAt,
          status: 'running',
          current_count: 0,
          released_count: 0,
          started_at: startedAt,
          finished_at: null,
          error_message: null,
        },
        { onConflict: 'source_updated_at' },
      );
    if (runStartError) throw runStartError;

    const [currentEntries, ledger] = await Promise.all([
      fetchCurrentWishlist(sourceUpdatedAt, Number(meta.shardCount)),
      fetchJsonWithRetry<Record<string, WishlistLedgerEntry>>(SOURCE_LEDGER_URL),
    ]);
    const expectedCurrentCount = Number(meta.current?.entryCount);
    if (!Number.isInteger(expectedCurrentCount) || currentEntries.size !== expectedCurrentCount) {
      throw new Error(
        `Current wishlist feed is incomplete: expected ${expectedCurrentCount}, received ${currentEntries.size}`,
      );
    }

    const currentLedger: Record<string, WishlistLedgerEntry> = Object.fromEntries(
      currentEntries,
    );
    for (const [appId, entry] of Object.entries(ledger)) {
      if (entry?.state === 'released') currentLedger[appId] = entry;
    }

    const expectedReleasedCount = Number(meta.released?.entryCount);
    const releasedLedgerCount = Object.values(currentLedger).filter(
      (entry) => entry?.state === 'released',
    ).length;
    if (!Number.isInteger(expectedReleasedCount) || releasedLedgerCount !== expectedReleasedCount) {
      throw new Error(
        `Released wishlist feed is incomplete: expected ${expectedReleasedCount}, received ${releasedLedgerCount}`,
      );
    }

    // Catalog membership/rank comes from TopWishlisted. Steam-owned metadata is
    // preserved here and refreshed only by the Steam details/popular syncs.
    const [existingByAppId, excludedAppIds] = await Promise.all([
      fetchExistingCatalog(supabase),
      fetchExcludedAppIds(supabase),
    ]);

    const now = new Date().toISOString();
    const rows = buildSteamCatalogRows({
      detailsByAppId: new Map(),
      excludedAppIds,
      existingByAppId,
      ledger: currentLedger,
      now,
      sourceUpdatedAt,
    });

    for (let offset = 0; offset < rows.length; offset += UPSERT_BATCH_SIZE) {
      const { error } = await supabase
        .from('steam_games')
        .upsert(rows.slice(offset, offset + UPSERT_BATCH_SIZE), { onConflict: 'steam_app_id' });
      if (error) throw error;
    }

    const activeAppIds = rows
      .filter((row) => row.lifecycle_status === 'upcoming' && row.is_wishlisted)
      .map((row) => row.steam_app_id);
    const initialStates = activeAppIds.flatMap((steamAppId) =>
      (['release', 'tags', 'media'] as const).map((component) => ({
        steam_app_id: steamAppId,
        component,
        status: 'pending',
      }))
    );
    for (let offset = 0; offset < initialStates.length; offset += UPSERT_BATCH_SIZE) {
      const { error } = await supabase
        .from('steam_game_enrichment_state')
        .upsert(initialStates.slice(offset, offset + UPSERT_BATCH_SIZE), {
          onConflict: 'steam_app_id,component',
          ignoreDuplicates: true,
        });
      if (error) throw error;
    }

    const { error: staleError } = await supabase
      .from('steam_games')
      .update({
        is_wishlisted: false,
        is_popular_upcoming: false,
        popular_upcoming_position: null,
      })
      .eq('lifecycle_status', 'upcoming')
      .lt('source_updated_at', sourceUpdatedAt);
    if (staleError) throw staleError;

    const { error: releasedPopularError } = await supabase
      .from('steam_games')
      .update({ is_popular_upcoming: false, popular_upcoming_position: null })
      .eq('lifecycle_status', 'released')
      .eq('is_popular_upcoming', true);
    if (releasedPopularError) throw releasedPopularError;

    const currentCount = rows.filter(
      (row) => row.lifecycle_status === 'upcoming' && row.is_wishlisted,
    ).length;
    const releasedCount = rows.filter((row) => row.lifecycle_status === 'released').length;
    const { error: runSuccessError } = await supabase
      .from('steam_catalog_sync_runs')
      .update({
        status: 'success',
        current_count: currentCount,
        released_count: releasedCount,
        finished_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('source_updated_at', sourceUpdatedAt);
    if (runSuccessError) throw runSuccessError;

    return Response.json({
      status: 'synced',
      sourceUpdatedAt,
      currentCount,
      releasedCount,
      excludedCount: excludedAppIds.size,
      eligibilityPolicyVersion: ELIGIBILITY_POLICY_VERSION,
      preservedSteamDetailsCount: existingByAppId.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Steam catalog sync failed', { sourceUpdatedAt, message });

    if (sourceUpdatedAt) {
      await supabase
        .from('steam_catalog_sync_runs')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          error_message: message.slice(0, 1000),
        })
        .eq('source_updated_at', sourceUpdatedAt);
    }

    return Response.json({ error: 'Steam catalog sync failed' }, { status: 500 });
  }
});

async function fetchExistingCatalog(
  supabase: ReturnType<typeof createClient>,
): Promise<Map<number, ExistingSteamCatalogRow>> {
  const rows: ExistingSteamCatalogRow[] = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('steam_games')
      .select('steam_app_id,image_url,release_date,release_label,tags')
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as ExistingSteamCatalogRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }

  return new Map(rows.map((row) => [Number(row.steam_app_id), row]));
}

async function fetchExcludedAppIds(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<number>> {
  const appIds = new Set<number>();

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('steam_catalog_exclusions')
      .select('steam_app_id')
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) appIds.add(Number(row.steam_app_id));
    if ((data?.length ?? 0) < 1000) break;
  }

  return appIds;
}

async function fetchCurrentWishlist(sourceUpdatedAt: string, shardCount: number) {
  const shardIds = Array.from(
    { length: shardCount },
    (_, index) => index.toString(16).padStart(2, '0'),
  );
  const shards = await mapWithConcurrency(
    shardIds,
    SHARD_CONCURRENCY,
    async (shardId) => fetchJsonWithRetry<CurrentShard>(
      `${SOURCE_CURRENT_BASE_URL}/${shardId}.json`,
    ),
  );
  const entries = new Map<string, WishlistLedgerEntry>();

  for (const shard of shards) {
    if (
      Number(shard.schemaVersion) !== 2 ||
      shard.kind !== 'current' ||
      shard.updatedAt !== sourceUpdatedAt ||
      !shard.entries
    ) {
      throw new Error('Current wishlist shard is invalid or stale');
    }

    for (const [appId, entry] of Object.entries(shard.entries)) {
      if (entries.has(appId)) throw new Error(`Duplicate Steam app ${appId} in current feed`);
      entries.set(appId, {
        name: entry.name,
        state: 'upcoming',
        preRelease: { rank: entry.rank, estimate: entry.estimate },
      });
    }
  }

  return entries;
}

async function fetchJsonWithRetry<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(400 * attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await task(values[index]!);
      }
    }),
  );

  return results;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
