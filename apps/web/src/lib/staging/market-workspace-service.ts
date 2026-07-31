import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSteamBetTrends } from '@/data/steam-bets';
import { getSteamCatalogGames, getSteamCatalogGamesByIdsAnyLifecycle } from '@/data/steam-game-catalog';
import { getSteamPopularUpcoming } from '@/data/steam-popular-upcoming';
import { percentileValue } from './scoring';
import { createStagingAdminClient } from './admin-client';
import { getVisibleSimulationPlayers } from './player-visibility';
import { executeSimulationCommand, getGameMasterData } from './simulation-service';
import type { StagingWorkspaceData } from './market-workspace-types';
import type { StagingMetric, StagingPrincipal, StagingWorkspaceCommand } from './types';

type SimulationRow = {
  id: string;
  name: string;
  status: string;
  simulation_time: string;
  random_seed: number;
  config: Record<string, unknown>;
};

type SimulationGameRow = {
  id: string;
  simulation_id: string;
  steam_app_id: number | null;
  name: string;
  release_at: string | null;
  scenario_values: Record<string, number>;
};

type SimulationMarketRow = {
  id: string;
  simulation_id: string;
  game_id: string;
  metric_type: StagingMetric;
  status: 'open' | 'locked' | 'resolved' | 'void';
  lock_at: string | null;
};

const METRICS: readonly StagingMetric[] = [
  'first_weekend_ccu',
  'first_month_reviews',
  'full_price_us',
];

const DEFAULT_SCENARIO_VALUES: Record<StagingMetric, number> = {
  first_weekend_ccu: 2_000,
  first_month_reviews: 1_200,
  full_price_us: 12,
};

function assertNoError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function rows<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : []) as T[];
}

async function assertWorkspace(client: SupabaseClient, simulationId: string) {
  const result = await client.from('simulations').select('*').eq('id', simulationId).single();
  assertNoError(result.error, 'Staging workspace not found');
  const simulation = result.data as SimulationRow;
  if (simulation.status === 'archived' || simulation.config?.market_workspace !== true) {
    throw new Error('This simulation is not the active staging workspace.');
  }
  return simulation;
}

async function seedWorkspacePlayers(client: SupabaseClient, simulationId: string) {
  const result = await client.from('simulation_players').insert([
    { simulation_id: simulationId, username: 'alex', display_name: 'Alex', behavior: 'random', skill: 0.5, metadata: { is_artificial: true } },
    { simulation_id: simulationId, username: 'blair', display_name: 'Blair', behavior: 'random', skill: 0.5, metadata: { is_artificial: true } },
    { simulation_id: simulationId, username: 'casey', display_name: 'Casey', behavior: 'random', skill: 0.5, metadata: { is_artificial: true } },
  ]);
  assertNoError(result.error, 'Could not seed staging players');
}

export async function getOrCreateStagingWorkspace(principal: StagingPrincipal) {
  const client = createStagingAdminClient();
  const existing = await client
    .from('simulations')
    .select('*')
    .contains('config', { market_workspace: true })
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  assertNoError(existing.error, 'Could not find staging workspace');
  if (existing.data) return existing.data as SimulationRow;

  const now = new Date();
  now.setUTCMilliseconds(0);
  const created = await client.from('simulations').insert({
    name: 'NextHit Market staging',
    description: 'Persistent gameplay workspace for the staging copy of NextHit Market.',
    preset_key: null,
    status: 'paused',
    simulation_time: now.toISOString(),
    started_at: now.toISOString(),
    random_seed: Date.now() % 2_147_483_647,
    config: { market_workspace: true, external_side_effects: false },
    created_by: principal.userId,
  }).select('*').single();
  assertNoError(created.error, 'Could not create staging workspace');
  const simulation = created.data as SimulationRow;
  await seedWorkspacePlayers(client, simulation.id);
  return simulation;
}

async function ensureWorkspaceGame(
  client: SupabaseClient,
  simulation: SimulationRow,
  steamAppId: number,
) {
  const existing = await client
    .from('simulation_games')
    .select('*')
    .eq('simulation_id', simulation.id)
    .eq('steam_app_id', steamAppId)
    .limit(1)
    .maybeSingle();
  assertNoError(existing.error, 'Could not inspect staging game');
  let game = existing.data as SimulationGameRow | null;

  if (!game) {
    const catalogResult = await client
      .from('steam_games')
      .select('steam_app_id,name,image_url,release_date,tags')
      .eq('steam_app_id', steamAppId)
      .eq('is_wishlisted', true)
      .single();
    assertNoError(catalogResult.error, 'Wishlist game not found in the staging catalog');
    const catalog = catalogResult.data as {
      steam_app_id: number;
      name: string;
      image_url: string | null;
      release_date: string | null;
      tags: string[] | null;
    };
    const simulationTime = new Date(simulation.simulation_time);
    const catalogRelease = catalog.release_date ? new Date(`${catalog.release_date}T00:00:00.000Z`) : null;
    const releaseAt = catalogRelease && catalogRelease > simulationTime
      ? catalogRelease
      : new Date(simulationTime.getTime() + 30 * 86_400_000);
    const inserted = await client.from('simulation_games').insert({
      simulation_id: simulation.id,
      steam_app_id: catalog.steam_app_id,
      name: catalog.name,
      release_at: releaseAt.toISOString(),
      hero_url: catalog.image_url,
      tags: (catalog.tags ?? []).slice(0, 10),
      scenario_values: DEFAULT_SCENARIO_VALUES,
    }).select('*').single();
    assertNoError(inserted.error, 'Could not add game to staging workspace');
    game = inserted.data as SimulationGameRow;
  }

  const releaseAt = new Date(game.release_at ?? new Date(simulation.simulation_time).getTime() + 30 * 86_400_000);
  const marketRows = METRICS.map((metricType) => ({
    simulation_id: simulation.id,
    game_id: game!.id,
    metric_type: metricType,
    status: 'open',
    lock_at: releaseAt.toISOString(),
    resolve_after: releaseAt.toISOString(),
  }));
  const marketsSaved = await client
    .from('simulation_markets')
    .upsert(marketRows, { onConflict: 'simulation_id,game_id,metric_type', ignoreDuplicates: true });
  assertNoError(marketsSaved.error, 'Could not prepare staging markets');
  const marketsResult = await client
    .from('simulation_markets')
    .select('*')
    .eq('simulation_id', simulation.id)
    .eq('game_id', game.id);
  assertNoError(marketsResult.error, 'Could not load staging markets');
  return { game, markets: rows<SimulationMarketRow>(marketsResult.data) };
}

function normalizeUsername(displayName: string, suffix = '') {
  const base = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `${base.length >= 3 ? base : 'player'}${suffix}`.slice(0, 32);
}

async function addWorkspacePlayer(
  client: SupabaseClient,
  simulation: SimulationRow,
  displayName: string,
) {
  const cleanName = displayName.trim().slice(0, 80);
  if (!cleanName) throw new Error('Player name is required.');
  const usernames = await client.from('simulation_players').select('username').eq('simulation_id', simulation.id);
  assertNoError(usernames.error, 'Could not inspect staging player names');
  const used = new Set(rows<{ username: string }>(usernames.data).map((row) => row.username));
  const base = normalizeUsername(cleanName);
  let username = base;
  let suffix = 2;
  while (used.has(username)) {
    username = normalizeUsername(cleanName, `_${suffix}`);
    suffix += 1;
  }
  const saved = await client.from('simulation_players').insert({
    simulation_id: simulation.id,
    username,
    display_name: cleanName,
    behavior: 'random',
    skill: 0.5,
    metadata: { is_artificial: true },
  }).select('*').single();
  assertNoError(saved.error, 'Could not add staging player');
  return saved.data;
}

async function placeForecast(
  client: SupabaseClient,
  simulation: SimulationRow,
  steamAppId: number,
  metricType: StagingMetric,
  playerId: string,
  rawValue: number,
) {
  if (!Number.isFinite(rawValue) || rawValue < 0) throw new Error('Forecast must be zero or greater.');
  const player = await client.from('simulation_players').select('id').eq('simulation_id', simulation.id).eq('id', playerId).single();
  assertNoError(player.error, 'Staging player not found');
  const prepared = await ensureWorkspaceGame(client, simulation, steamAppId);
  const market = prepared.markets.find((row) => row.metric_type === metricType);
  if (!market || market.status !== 'open') throw new Error('This staging market is closed.');
  const current = await client
    .from('simulation_forecast_versions')
    .select('id')
    .eq('simulation_id', simulation.id)
    .eq('market_id', market.id)
    .eq('player_id', playerId)
    .is('valid_to', null)
    .maybeSingle();
  assertNoError(current.error, 'Could not inspect current staging forecast');
  if (current.data) {
    const closed = await client.from('simulation_forecast_versions').update({ valid_to: simulation.simulation_time }).eq('id', current.data.id);
    assertNoError(closed.error, 'Could not replace staging forecast');
  }
  const saved = await client.from('simulation_forecast_versions').insert({
    simulation_id: simulation.id,
    market_id: market.id,
    player_id: playerId,
    raw_value: rawValue,
    percentile_value: percentileValue(metricType, rawValue),
    valid_from: simulation.simulation_time,
    source: 'staging-market',
  }).select('*').single();
  assertNoError(saved.error, 'Could not place staging forecast');
  return saved.data;
}

async function addRandomBatch(
  client: SupabaseClient,
  simulation: SimulationRow,
  command: Extract<StagingWorkspaceCommand, { action: 'batch_forecasts' }>,
) {
  const count = Math.max(1, Math.min(Math.trunc(command.count), 2_000));
  const minimum = Math.min(command.minimum, command.maximum);
  const maximum = Math.max(command.minimum, command.maximum);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0) throw new Error('Batch range is invalid.');
  const prepared = await ensureWorkspaceGame(client, simulation, command.steamAppId);
  const market = prepared.markets.find((row) => row.metric_type === command.metricType);
  if (!market || market.status !== 'open') throw new Error('This staging market is closed.');

  const nonce = Date.now().toString(36).slice(-7);
  let seed = (simulation.random_seed + Date.now() + command.steamAppId) % 2_147_483_647 || 1;
  const nextRandom = () => {
    seed = (seed * 48_271) % 2_147_483_647;
    return (seed - 1) / 2_147_483_646;
  };
  const playerRows = Array.from({ length: count }, (_, index) => ({
    simulation_id: simulation.id,
    username: `batch_${nonce}_${index.toString(36)}`.slice(0, 32),
    display_name: `Batch ${nonce.toUpperCase()} · ${index + 1}`.slice(0, 80),
    behavior: 'random',
    skill: 0.5,
    metadata: { is_artificial: true, is_batch: true },
  }));
  const playersSaved = await client.from('simulation_players').insert(playerRows).select('id');
  assertNoError(playersSaved.error, 'Could not create batch players');
  const players = rows<{ id: string }>(playersSaved.data);
  const integerMetric = command.metricType !== 'full_price_us';
  const forecasts = players.map((player) => {
    const value = minimum + nextRandom() * (maximum - minimum);
    const rawValue = integerMetric ? Math.round(value) : Math.round(value * 100) / 100;
    return {
      simulation_id: simulation.id,
      market_id: market.id,
      player_id: player.id,
      raw_value: rawValue,
      percentile_value: percentileValue(command.metricType, rawValue),
      valid_from: simulation.simulation_time,
      source: 'staging-random-batch',
    };
  });
  const forecastsSaved = await client.from('simulation_forecast_versions').insert(forecasts);
  if (forecastsSaved.error) {
    await client.from('simulation_players').delete().in('id', players.map((player) => player.id));
    assertNoError(forecastsSaved.error, 'Could not create randomized batch forecasts');
  }
  return { players: players.length, forecasts: forecasts.length };
}

async function resolveWorkspaceGame(
  client: SupabaseClient,
  simulation: SimulationRow,
  steamAppId: number,
  actualValues: Record<StagingMetric, number>,
  principal: StagingPrincipal,
) {
  const prepared = await ensureWorkspaceGame(client, simulation, steamAppId);
  const currentTime = new Date(simulation.simulation_time);
  const futureLock = new Date(currentTime.getTime() + 86_400_000).toISOString();
  for (const market of prepared.markets) {
    if (market.status === 'open' && market.lock_at && new Date(market.lock_at) <= currentTime) {
      const moved = await client.from('simulation_markets').update({ lock_at: futureLock }).eq('id', market.id);
      assertNoError(moved.error, 'Could not prepare staging market snapshot');
    }
  }
  await executeSimulationCommand({ action: 'snapshot', simulationId: simulation.id }, principal);

  const resolved: Array<{ marketId: string; actualValue: number }> = [];
  for (const market of prepared.markets) {
    if (market.status === 'resolved' || market.status === 'void') continue;
    const actualValue = actualValues[market.metric_type];
    if (market.status === 'open') {
      await executeSimulationCommand({ action: 'lock', simulationId: simulation.id, marketId: market.id }, principal);
    }
    await executeSimulationCommand({
      action: 'resolve',
      simulationId: simulation.id,
      marketId: market.id,
      actualValue,
      note: 'Resolved from the staging game card.',
    }, principal);
    resolved.push({ marketId: market.id, actualValue });
  }
  return { steamAppId, resolved };
}

export async function executeStagingWorkspaceCommand(
  command: StagingWorkspaceCommand,
  principal: StagingPrincipal,
) {
  const client = createStagingAdminClient();
  const simulation = await assertWorkspace(client, command.simulationId);
  switch (command.action) {
    case 'add_player':
      return addWorkspacePlayer(client, simulation, command.displayName);
    case 'delete_player': {
      const removed = await client.from('simulation_players').delete().eq('simulation_id', simulation.id).eq('id', command.playerId).select('id').single();
      assertNoError(removed.error, 'Staging player not found');
      return { deleted: command.playerId };
    }
    case 'place_forecast':
      return placeForecast(client, simulation, command.steamAppId, command.metricType, command.playerId, command.rawValue);
    case 'batch_forecasts':
      return addRandomBatch(client, simulation, command);
    case 'resolve_game':
      return resolveWorkspaceGame(client, simulation, command.steamAppId, command.actualValues, principal);
  }
}

export async function getStagingWorkspaceData(principal: StagingPrincipal): Promise<StagingWorkspaceData> {
  const workspace = await getOrCreateStagingWorkspace(principal);
  const state = await getGameMasterData(workspace.id);
  if (!state.selected) throw new Error('Staging workspace could not be loaded.');
  const selected = state.selected;
  const visiblePlayers = getVisibleSimulationPlayers(selected.players);
  const simulationGames = selected.games as Array<typeof selected.games[number] & { steam_app_id: number | null }>;
  const workspaceAppIds = simulationGames.flatMap((game) => game.steam_app_id === null ? [] : [Number(game.steam_app_id)]);
  const [popularPage, wishlistGames, baselineTrends] = await Promise.all([
    getSteamPopularUpcoming({ limit: 50, offset: 0 }),
    getSteamCatalogGames(200),
    getSteamBetTrends().catch((error: unknown) => {
      console.error('Could not load baseline staging trends.', error);
      return [];
    }),
  ]);
  const trendingAppIds = baselineTrends.map((trend) => trend.steam_app_id);
  const workspaceCatalogGames = await getSteamCatalogGamesByIdsAnyLifecycle([
    ...workspaceAppIds,
    ...trendingAppIds,
  ]);
  const catalogMap = new Map(
    [...(wishlistGames ?? []), ...popularPage.games, ...workspaceCatalogGames]
      .map((game) => [game.appId, game] as const),
  );
  const activeForecasts = selected.forecasts.filter((forecast) => forecast.valid_to === null);
  const marketsByGame = new Map<string, typeof selected.markets>();
  for (const market of selected.markets) {
    const collection = marketsByGame.get(market.game_id) ?? [];
    collection.push(market);
    marketsByGame.set(market.game_id, collection);
  }
  const games = simulationGames.flatMap((game) => {
    if (game.steam_app_id === null) return [];
    const markets = marketsByGame.get(game.id) ?? [];
    return [{
      steamAppId: Number(game.steam_app_id),
      simulationGameId: game.id,
      completed: markets.length === METRICS.length && markets.every((market) => market.status === 'resolved' || market.status === 'void'),
      markets: markets.map((market) => {
        const forecasts = activeForecasts.filter((forecast) => forecast.market_id === market.id);
        return {
          id: market.id,
          metricType: market.metric_type as StagingMetric,
          status: market.status as 'open' | 'locked' | 'resolved' | 'void',
          averageValue: forecasts.length
            ? forecasts.reduce((sum, forecast) => sum + Number(forecast.raw_value), 0) / forecasts.length
            : null,
          predictionCount: forecasts.length,
          actualValue: selected.marketStats[market.id]?.actualResult ?? null,
          forecasts: forecasts.map((forecast) => ({ playerId: forecast.player_id, value: Number(forecast.raw_value) })),
        };
      }),
    }];
  });
  const scored = new Map(selected.leaderboard.map((row) => [row.playerId, row]));
  const leaderboard = visiblePlayers
    .map((player) => ({
      rank: 0,
      playerId: player.id,
      username: player.username,
      displayName: player.display_name,
      points: Number(scored.get(player.id)?.points ?? 0),
      resolvedMarkets: Number(scored.get(player.id)?.resolvedMarkets ?? 0),
    }))
    .sort((left, right) => right.points - left.points || right.resolvedMarkets - left.resolvedMarkets || left.displayName.localeCompare(right.displayName))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    simulation: {
      id: selected.simulation.id,
      name: selected.simulation.name,
      simulationTime: selected.simulation.simulation_time,
    },
    catalogGames: [...catalogMap.values()],
    popularAppIds: popularPage.games.map((game) => game.appId),
    trendingAppIds,
    players: visiblePlayers.map((player) => ({ id: player.id, username: player.username, displayName: player.display_name })),
    games,
    leaderboard,
  };
}
