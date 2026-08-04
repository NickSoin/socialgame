import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { advanceClock } from './clock';
import { createStagingAdminClient } from './admin-client';
import { isBatchSimulationPlayer } from './player-visibility';
import { getPreset, SIMULATION_PRESETS } from './presets';
import { canonicalPoints, percentileValue, scoreInputs } from './scoring';
import type {
  BotBehavior,
  SimulationCommand,
  SimulationPreset,
  StagingMetric,
  StagingPrincipal,
} from './types';

type SimulationRow = {
  id: string;
  name: string;
  description: string;
  preset_key: string | null;
  status: 'draft' | 'running' | 'paused' | 'archived';
  simulation_time: string;
  started_at: string | null;
  random_seed: number;
  config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type GameRow = {
  id: string;
  simulation_id: string;
  name: string;
  release_at: string | null;
  scenario_values: Record<StagingMetric, number>;
  tags: string[];
  hero_url: string | null;
};

type MarketRow = {
  id: string;
  simulation_id: string;
  game_id: string;
  metric_type: StagingMetric;
  status: 'open' | 'locked' | 'resolved' | 'void';
  lock_at: string | null;
  resolve_after: string | null;
};

type PlayerRow = {
  id: string;
  simulation_id: string;
  username: string;
  display_name: string;
  behavior: BotBehavior;
  skill: number;
  metadata: Record<string, unknown>;
};

type ForecastRow = {
  id: string;
  simulation_id: string;
  market_id: string;
  player_id: string;
  raw_value: number;
  percentile_value: number;
  valid_from: string;
  valid_to: string | null;
  source: string;
};

type SnapshotRow = {
  id: string;
  simulation_id: string;
  market_id: string;
  snapshot_at: string;
  eligible_prediction_count: number;
  crowd_percentile: number | null;
};

type JsonRecord = Record<string, unknown>;

const METRICS: readonly StagingMetric[] = [
  'first_weekend_ccu',
  'first_month_reviews',
  'full_price_us',
  'launch_discount',
];

const BEHAVIORS: readonly BotBehavior[] = [
  'follower', 'contrarian', 'expert', 'late', 'random', 'outlier',
];

class DeterministicRandom {
  private state: number;

  constructor(seed: number) {
    this.state = Math.abs(Math.trunc(seed)) % 2_147_483_647 || 1;
  }

  next() {
    this.state = (this.state * 48_271) % 2_147_483_647;
    return (this.state - 1) / 2_147_483_646;
  }

  normal() {
    const left = Math.max(this.next(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * this.next());
  }
}

function rows<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : []) as T[];
}

function first<T>(value: unknown): T {
  return value as T;
}

function assertNoError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function metricResolveAfter(metric: StagingMetric, releaseAt: Date) {
  if (metric === 'full_price_us' || metric === 'launch_discount') return releaseAt;
  if (metric === 'first_month_reviews') return new Date(releaseAt.getTime() + 30 * 86_400_000);
  const day = releaseAt.getUTCDay() || 7;
  const nextMonday = new Date(releaseAt);
  nextMonday.setUTCDate(releaseAt.getUTCDate() + (8 - day));
  nextMonday.setUTCHours(0, 0, 0, 0);
  return nextMonday;
}

function behaviorForIndex(preset: SimulationPreset, random: DeterministicRandom) {
  const weights = preset.behaviorWeights ?? { random: 1 };
  const total = BEHAVIORS.reduce((sum, behavior) => sum + (weights[behavior] ?? 0), 0) || 1;
  let cursor = random.next() * total;
  for (const behavior of BEHAVIORS) {
    cursor -= weights[behavior] ?? 0;
    if (cursor <= 0) return behavior;
  }
  return 'random' as const;
}

function forecastValue(
  metric: StagingMetric,
  actual: number,
  behavior: BotBehavior,
  skill: number,
  random: DeterministicRandom,
) {
  const baseNoise = Math.max(0.025, 0.58 - skill * 0.48);
  let multiplier = 1 + random.normal() * baseNoise;
  if (behavior === 'expert') multiplier = 1 + random.normal() * baseNoise * 0.34;
  if (behavior === 'follower') multiplier = 1 + random.normal() * baseNoise * 0.65;
  if (behavior === 'contrarian') multiplier = 1 - Math.sign(random.normal() || 1) * (0.15 + random.next() * 0.45);
  if (behavior === 'outlier') multiplier = random.next() > 0.5 ? 0.08 + random.next() * 0.18 : 3 + random.next() * 7;
  if (behavior === 'late') multiplier = 1 + random.normal() * baseNoise * 0.55;
  const value = Math.max(0, actual * multiplier);
  return metric === 'full_price_us' ? Math.round(value * 100) / 100 : Math.round(value);
}

async function logEvent(
  client: SupabaseClient,
  simulation: Pick<SimulationRow, 'id' | 'simulation_time'>,
  principal: StagingPrincipal,
  eventType: string,
  payload: JsonRecord = {},
  marketId?: string,
  playerId?: string,
) {
  const { error } = await client.from('simulation_events').insert({
    simulation_id: simulation.id,
    event_type: eventType,
    event_at: simulation.simulation_time,
    actor_user_id: principal.userId,
    market_id: marketId,
    player_id: playerId,
    payload,
  });
  assertNoError(error, 'Could not append simulation event');
}

async function getSimulation(client: SupabaseClient, simulationId: string) {
  const { data, error } = await client.from('simulations').select('*').eq('id', simulationId).single();
  assertNoError(error, 'Simulation not found');
  return first<SimulationRow>(data);
}

async function createPlayers(
  client: SupabaseClient,
  simulation: SimulationRow,
  preset: SimulationPreset,
  count: number,
  options: { prefix?: string; behavior?: BotBehavior; skillMin?: number; skillMax?: number; seed?: number; avatarMode?: string } = {},
) {
  const existingResult = await client
    .from('simulation_players')
    .select('id', { count: 'exact', head: true })
    .eq('simulation_id', simulation.id);
  assertNoError(existingResult.error, 'Could not count simulation players');
  const offset = existingResult.count ?? 0;
  const random = new DeterministicRandom(options.seed ?? simulation.random_seed + offset * 97 + count);
  const skillMin = Math.min(options.skillMin ?? 0.2, options.skillMax ?? 0.95);
  const skillMax = Math.max(options.skillMin ?? 0.2, options.skillMax ?? 0.95);
  const safePrefix = (options.prefix ?? 'sim').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20) || 'sim';
  const inserts = Array.from({ length: count }, (_, index) => {
    const sequence = offset + index + 1;
    const behavior = options.behavior ?? behaviorForIndex(preset, random);
    return {
      simulation_id: simulation.id,
      username: `${safePrefix}_${String(sequence).padStart(4, '0')}`.slice(0, 32),
      display_name: `${options.prefix ?? behavior[0].toUpperCase() + behavior.slice(1)} ${sequence}`.slice(0, 80),
      behavior,
      skill: Math.round((skillMin + random.next() * (skillMax - skillMin)) * 1000) / 1000,
      metadata: { is_seeded: true, seed_index: sequence, avatar_mode: options.avatarMode ?? 'generated-initials' },
    };
  });
  if (!inserts.length) return [];
  const { data, error } = await client.from('simulation_players').insert(inserts).select('*');
  assertNoError(error, 'Could not create simulation players');
  return rows<PlayerRow>(data);
}

async function scheduleForecasts(
  client: SupabaseClient,
  simulation: SimulationRow,
  preset: SimulationPreset,
  density = 1,
  options: {
    marketId?: string;
    distribution?: 'around_actual' | 'around_consensus' | 'fixed' | 'uniform' | 'normal' | 'log_normal';
    center?: number;
    spread?: number;
    minimum?: number;
    maximum?: number;
    timing?: 'opening' | 'uniform' | 'early' | 'late' | 'specific' | 'event';
    scheduledAt?: string;
  } = {},
) {
  const [playersResult, marketsResult, gamesResult] = await Promise.all([
    client.from('simulation_players').select('*').eq('simulation_id', simulation.id),
    client.from('simulation_markets').select('*').eq('simulation_id', simulation.id).eq('status', 'open'),
    client.from('simulation_games').select('*').eq('simulation_id', simulation.id),
  ]);
  assertNoError(playersResult.error, 'Could not load players');
  assertNoError(marketsResult.error, 'Could not load markets');
  assertNoError(gamesResult.error, 'Could not load games');
  const players = rows<PlayerRow>(playersResult.data).filter((player) => player.metadata?.disabled !== true);
  const markets = rows<MarketRow>(marketsResult.data).filter((market) => !options.marketId || market.id === options.marketId);
  const games = new Map(rows<GameRow>(gamesResult.data).map((game) => [game.id, game]));
  const random = new DeterministicRandom(simulation.random_seed + 31_337);
  const scheduled: JsonRecord[] = [];

  function generatedValue(market: MarketRow, actual: number, player: PlayerRow) {
    const distribution = options.distribution ?? 'around_actual';
    const center = Math.max(0, options.center ?? actual);
    const spread = Math.max(0, options.spread ?? Math.max(1, center * 0.2));
    let value: number;
    if (distribution === 'fixed') value = center;
    else if (distribution === 'uniform') value = center - spread + random.next() * spread * 2;
    else if (distribution === 'normal') value = center + random.normal() * spread;
    else if (distribution === 'log_normal') value = Math.exp(Math.log(Math.max(0.01, center)) + random.normal() * Math.min(2, spread / Math.max(1, center)));
    else if (distribution === 'around_consensus') value = center + random.normal() * spread * Math.max(0.1, 1 - player.skill);
    else value = forecastValue(market.metric_type, actual, player.behavior, player.skill, random);
    return Math.max(options.minimum ?? 0, Math.min(options.maximum ?? 100_000_000, value));
  }

  for (const market of markets) {
    const game = games.get(market.game_id);
    if (!game) continue;
    const actual = Number(game.scenario_values[market.metric_type]);
    const start = new Date(simulation.simulation_time).getTime();
    const lock = new Date(market.lock_at ?? new Date(start + 14 * 86_400_000)).getTime();
    const windowMs = Math.max(3_600_000, lock - start);
    for (const player of players) {
      if (random.next() > density * (1 - (preset.sparsity ?? 0))) continue;
      const timing = options.timing ?? (player.behavior === 'late' ? 'late' : 'uniform');
      const unit = random.next();
      const position = timing === 'opening' ? 0
        : timing === 'early' ? 0.02 + unit ** 2 * 0.45
          : timing === 'late' ? 0.7 + (1 - unit ** 2) * 0.28
            : timing === 'specific' || timing === 'event' ? 0
              : 0.04 + unit * 0.72;
      const specificAt = options.scheduledAt ? new Date(options.scheduledAt) : null;
      const scheduledAt = specificAt && Number.isFinite(specificAt.getTime()) ? specificAt : new Date(start + windowMs * position);
      if (scheduledAt < new Date(start) || scheduledAt >= new Date(lock)) continue;
      const value = generatedValue(market, actual, player);
      scheduled.push({
        simulation_id: simulation.id,
        market_id: market.id,
        player_id: player.id,
        raw_value: market.metric_type === 'full_price_us' ? Math.round(value * 100) / 100 : Math.round(value),
        percentile_value: percentileValue(market.metric_type, value),
        scheduled_at: scheduledAt.toISOString(),
        source: `bot:${player.behavior}:${options.distribution ?? 'around_actual'}`,
      });

      if (!options.scheduledAt && random.next() < (preset.editRate ?? 0.12)) {
        const revised = forecastValue(market.metric_type, actual, player.behavior, Math.min(1, player.skill + 0.12), random);
        scheduled.push({
          simulation_id: simulation.id,
          market_id: market.id,
          player_id: player.id,
          raw_value: revised,
          percentile_value: percentileValue(market.metric_type, revised),
          scheduled_at: new Date(start + windowMs * Math.min(0.98, position + 0.08 + random.next() * 0.14)).toISOString(),
          source: `bot-edit:${player.behavior}`,
        });
      }
    }
  }

  if (scheduled.length) {
    const { error } = await client.from('simulation_scheduled_forecasts').upsert(scheduled, {
      onConflict: 'simulation_id,market_id,player_id,scheduled_at',
      ignoreDuplicates: true,
    });
    assertNoError(error, 'Could not schedule forecasts');
  }
  return scheduled.length;
}

async function processDueForecasts(client: SupabaseClient, simulation: SimulationRow, target: Date) {
  const dueResult = await client
    .from('simulation_scheduled_forecasts')
    .select('*')
    .eq('simulation_id', simulation.id)
    .is('processed_at', null)
    .lte('scheduled_at', target.toISOString())
    .order('scheduled_at');
  assertNoError(dueResult.error, 'Could not load due forecasts');
  const due = rows<ForecastRow & { scheduled_at: string }>(dueResult.data);

  for (const forecast of due) {
    const marketResult = await client.from('simulation_markets').select('status,lock_at').eq('id', forecast.market_id).single();
    assertNoError(marketResult.error, 'Could not validate forecast market');
    const market = first<{ status: string; lock_at: string | null }>(marketResult.data);
    if (market.status !== 'open' || (market.lock_at && new Date(forecast.scheduled_at) >= new Date(market.lock_at))) {
      const skipped = await client.from('simulation_scheduled_forecasts').update({ processed_at: target.toISOString() }).eq('id', forecast.id);
      assertNoError(skipped.error, 'Could not mark skipped forecast');
      continue;
    }
    const closeResult = await client
      .from('simulation_forecast_versions')
      .update({ valid_to: forecast.scheduled_at })
      .eq('simulation_id', simulation.id)
      .eq('market_id', forecast.market_id)
      .eq('player_id', forecast.player_id)
      .is('valid_to', null);
    assertNoError(closeResult.error, 'Could not close forecast version');
    const insertResult = await client.from('simulation_forecast_versions').insert({
      simulation_id: simulation.id,
      market_id: forecast.market_id,
      player_id: forecast.player_id,
      raw_value: forecast.raw_value,
      percentile_value: forecast.percentile_value,
      valid_from: forecast.scheduled_at,
      source: forecast.source,
    });
    assertNoError(insertResult.error, 'Could not create forecast version');
    const processed = await client
      .from('simulation_scheduled_forecasts')
      .update({ processed_at: target.toISOString() })
      .eq('id', forecast.id);
    assertNoError(processed.error, 'Could not mark forecast processed');
  }
  return due.length;
}

async function createSnapshot(client: SupabaseClient, simulation: SimulationRow, at: Date) {
  const marketsResult = await client
    .from('simulation_markets')
    .select('*')
    .eq('simulation_id', simulation.id)
    .neq('status', 'void');
  assertNoError(marketsResult.error, 'Could not load snapshot markets');
  let created = 0;

  for (const market of rows<MarketRow>(marketsResult.data)) {
    if (market.lock_at && at >= new Date(market.lock_at)) continue;
    const versionsResult = await client
      .from('simulation_forecast_versions')
      .select('*')
      .eq('simulation_id', simulation.id)
      .eq('market_id', market.id)
      .lte('valid_from', at.toISOString())
      .order('valid_from', { ascending: false });
    assertNoError(versionsResult.error, 'Could not load snapshot forecast versions');
    const latest = new Map<string, ForecastRow>();
    for (const version of rows<ForecastRow>(versionsResult.data)) {
      if ((!version.valid_to || new Date(version.valid_to) > at) && !latest.has(version.player_id)) {
        latest.set(version.player_id, version);
      }
    }
    const members = [...latest.values()];
    const crowd = members.length
      ? members.reduce((sum, member) => sum + Number(member.percentile_value), 0) / members.length
      : null;
    const snapshotResult = await client
      .from('simulation_snapshots')
      .upsert({
        simulation_id: simulation.id,
        market_id: market.id,
        snapshot_at: at.toISOString(),
        eligible_prediction_count: members.length,
        crowd_percentile: crowd,
      }, { onConflict: 'simulation_id,market_id,snapshot_at' })
      .select('*')
      .single();
    assertNoError(snapshotResult.error, 'Could not create simulation snapshot');
    const snapshot = first<SnapshotRow>(snapshotResult.data);
    if (members.length) {
      const membershipResult = await client.from('simulation_snapshot_predictions').upsert(
        members.map((member) => ({
          simulation_id: simulation.id,
          snapshot_id: snapshot.id,
          forecast_version_id: member.id,
          player_id: member.player_id,
          raw_value: member.raw_value,
          percentile_value: member.percentile_value,
        })),
        { onConflict: 'snapshot_id,player_id' },
      );
      assertNoError(membershipResult.error, 'Could not create snapshot membership');
    }
    created += 1;
  }
  return created;
}

async function advanceSimulation(
  client: SupabaseClient,
  simulation: SimulationRow,
  target: Date,
  principal: StagingPrincipal,
) {
  if (target <= new Date(simulation.simulation_time)) throw new RangeError('Simulation time can only move forward.');
  const dueForecasts = await processDueForecasts(client, simulation, target);
  const lockResult = await client
    .from('simulation_markets')
    .update({ status: 'locked' })
    .eq('simulation_id', simulation.id)
    .eq('status', 'open')
    .not('lock_at', 'is', null)
    .lte('lock_at', target.toISOString())
    .select('id');
  assertNoError(lockResult.error, 'Could not lock due markets');

  let cursor = new Date(simulation.simulation_time);
  cursor.setUTCHours(24, 0, 0, 0);
  let snapshotCount = 0;
  while (cursor <= target) {
    snapshotCount += await createSnapshot(client, simulation, cursor);
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  const updateResult = await client
    .from('simulations')
    .update({ simulation_time: target.toISOString() })
    .eq('id', simulation.id);
  assertNoError(updateResult.error, 'Could not advance simulation clock');
  const atTarget = { ...simulation, simulation_time: target.toISOString() };
  await logEvent(client, atTarget, principal, 'clock_advanced', {
    from: simulation.simulation_time,
    to: target.toISOString(),
    due_forecasts: dueForecasts,
    locked_markets: rows<JsonRecord>(lockResult.data).length,
    snapshots: snapshotCount,
  });
  return atTarget;
}

async function resolveMarket(
  client: SupabaseClient,
  simulation: SimulationRow,
  marketId: string,
  actualRawValue: number,
  principal: StagingPrincipal,
  note?: string,
) {
  const marketResult = await client.from('simulation_markets').select('*').eq('simulation_id', simulation.id).eq('id', marketId).single();
  assertNoError(marketResult.error, 'Simulation market not found');
  const market = first<MarketRow>(marketResult.data);
  if (!Number.isFinite(actualRawValue) || actualRawValue < 0) throw new RangeError('Actual value must be zero or greater.');
  if (market.status === 'open' || market.status === 'void') throw new Error('Only locked or resolved markets can be resolved.');

  const resultVersionResult = await client
    .from('simulation_results')
    .select('result_version')
    .eq('simulation_id', simulation.id)
    .eq('market_id', market.id)
    .order('result_version', { ascending: false })
    .limit(1);
  assertNoError(resultVersionResult.error, 'Could not read result version');
  const nextResultVersion = Number(rows<{ result_version: number }>(resultVersionResult.data)[0]?.result_version ?? 0) + 1;
  const actualPercentile = percentileValue(market.metric_type, actualRawValue);

  const expireResults = await client.from('simulation_results').update({ is_current: false }).eq('simulation_id', simulation.id).eq('market_id', market.id).eq('is_current', true);
  assertNoError(expireResults.error, 'Could not supersede result');
  const savedResultQuery = await client.from('simulation_results').insert({
    simulation_id: simulation.id,
    market_id: market.id,
    result_version: nextResultVersion,
    actual_raw_value: actualRawValue,
    actual_percentile_value: actualPercentile,
    source_reference: 'staging-simulation',
    resolved_at: simulation.simulation_time,
    correction_note: note ?? null,
    created_by: principal.userId,
  }).select('*').single();
  assertNoError(savedResultQuery.error, 'Could not save result');
  const savedResult = first<{ id: string }>(savedResultQuery.data);

  const expireRuns = await client.from('simulation_score_runs').update({ is_current: false }).eq('simulation_id', simulation.id).eq('market_id', market.id).eq('formula_key', 'canonical').eq('is_current', true);
  assertNoError(expireRuns.error, 'Could not supersede score run');
  const runVersionResult = await client.from('simulation_score_runs').select('run_version').eq('simulation_id', simulation.id).eq('market_id', market.id).eq('formula_key', 'canonical').order('run_version', { ascending: false }).limit(1);
  assertNoError(runVersionResult.error, 'Could not read score run version');
  const nextRunVersion = Number(rows<{ run_version: number }>(runVersionResult.data)[0]?.run_version ?? 0) + 1;
  const runResult = await client.from('simulation_score_runs').insert({
    simulation_id: simulation.id,
    market_id: market.id,
    result_id: savedResult.id,
    run_version: nextRunVersion,
    reason: nextRunVersion === 1 ? 'initial resolution' : 'result correction',
    formula_key: 'canonical',
    created_by: principal.userId,
  }).select('id').single();
  assertNoError(runResult.error, 'Could not create score run');
  const runId = first<{ id: string }>(runResult.data).id;

  const snapshotsResult = await client.from('simulation_snapshots').select('*').eq('simulation_id', simulation.id).eq('market_id', market.id);
  assertNoError(snapshotsResult.error, 'Could not load market snapshots');
  const entries: JsonRecord[] = [];
  for (const snapshot of rows<SnapshotRow>(snapshotsResult.data)) {
    if (snapshot.eligible_prediction_count < 2 || snapshot.crowd_percentile === null) continue;
    const membershipResult = await client.from('simulation_snapshot_predictions').select('*').eq('snapshot_id', snapshot.id);
    assertNoError(membershipResult.error, 'Could not load snapshot membership');
    for (const membership of rows<{ player_id: string; percentile_value: number }>(membershipResult.data)) {
      const user = Number(membership.percentile_value);
      const crowdWithoutUser = (
        Number(snapshot.crowd_percentile) * snapshot.eligible_prediction_count - user
      ) / (snapshot.eligible_prediction_count - 1);
      const score = scoreInputs(user, crowdWithoutUser, actualPercentile);
      entries.push({
        simulation_id: simulation.id,
        score_run_id: runId,
        market_id: market.id,
        snapshot_id: snapshot.id,
        player_id: membership.player_id,
        user_percentile: user,
        crowd_without_user_percentile: crowdWithoutUser,
        actual_percentile: actualPercentile,
        user_error: score.userError,
        crowd_error: score.crowdError,
        points: canonicalPoints(user, crowdWithoutUser, actualPercentile),
      });
    }
  }
  if (entries.length) {
    const entryResult = await client.from('simulation_score_entries').insert(entries);
    assertNoError(entryResult.error, 'Could not save simulation score entries');
  }
  const statusResult = await client.from('simulation_markets').update({ status: 'resolved' }).eq('id', market.id);
  assertNoError(statusResult.error, 'Could not mark market resolved');
  await logEvent(client, simulation, principal, nextRunVersion === 1 ? 'market_resolved' : 'market_corrected', {
    actual_raw_value: actualRawValue,
    actual_percentile: actualPercentile,
    scored_entries: entries.length,
    result_version: nextResultVersion,
    note: note ?? null,
  }, market.id);
  return { resultVersion: nextResultVersion, scoreEntries: entries.length };
}

async function clearMarketData(client: SupabaseClient, simulationId: string, marketId: string, includeForecasts = true) {
  const snapshotResult = await client.from('simulation_snapshots').select('id').eq('simulation_id', simulationId).eq('market_id', marketId);
  assertNoError(snapshotResult.error, 'Could not inspect market snapshots');
  const snapshotIds = rows<{ id: string }>(snapshotResult.data).map((row) => row.id);
  const runDelete = await client.from('simulation_score_runs').delete().eq('simulation_id', simulationId).eq('market_id', marketId);
  assertNoError(runDelete.error, 'Could not clear market score runs');
  const resultDelete = await client.from('simulation_results').delete().eq('simulation_id', simulationId).eq('market_id', marketId);
  assertNoError(resultDelete.error, 'Could not clear market results');
  if (snapshotIds.length) {
    const memberDelete = await client.from('simulation_snapshot_predictions').delete().in('snapshot_id', snapshotIds);
    assertNoError(memberDelete.error, 'Could not clear snapshot members');
  }
  const snapshotDelete = await client.from('simulation_snapshots').delete().eq('simulation_id', simulationId).eq('market_id', marketId);
  assertNoError(snapshotDelete.error, 'Could not clear market snapshots');
  if (includeForecasts) {
    const scheduledDelete = await client.from('simulation_scheduled_forecasts').delete().eq('simulation_id', simulationId).eq('market_id', marketId);
    assertNoError(scheduledDelete.error, 'Could not clear scheduled forecasts');
    const forecastDelete = await client.from('simulation_forecast_versions').delete().eq('simulation_id', simulationId).eq('market_id', marketId);
    assertNoError(forecastDelete.error, 'Could not clear forecast history');
  }
}

const EXPORT_TABLES = [
  'simulation_games', 'simulation_markets', 'simulation_players',
  'simulation_forecast_versions', 'simulation_scheduled_forecasts',
  'simulation_snapshots', 'simulation_snapshot_predictions',
  'simulation_results', 'simulation_score_runs', 'simulation_score_entries',
] as const;

async function exportSimulation(client: SupabaseClient, simulationId: string) {
  const simulation = await getSimulation(client, simulationId);
  const collections = await Promise.all(EXPORT_TABLES.map(async (table) => {
    const { data, error } = await client.from(table).select('*').eq('simulation_id', simulationId);
    assertNoError(error, `Could not export ${table}`);
    return [table, data ?? []] as const;
  }));
  return {
    format: 'nexthit-simulation-v1',
    exportedAt: new Date().toISOString(),
    simulation,
    ...Object.fromEntries(collections),
  };
}

function importCollection(payload: JsonRecord, table: (typeof EXPORT_TABLES)[number]) {
  const collection = payload[table];
  if (!Array.isArray(collection) || collection.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error(`Invalid ${table} collection in simulation export.`);
  }
  return collection as JsonRecord[];
}

function mappedId(map: Map<string, string>, source: unknown, label: string) {
  const value = typeof source === 'string' ? map.get(source) : undefined;
  if (!value) throw new Error(`Invalid ${label} reference in simulation export.`);
  return value;
}

async function importSimulation(
  client: SupabaseClient,
  principal: StagingPrincipal,
  rawPayload: unknown,
  nameOverride?: string,
) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new Error('Simulation import must be a JSON object.');
  }
  const payload = rawPayload as JsonRecord;
  if (payload.format !== 'nexthit-simulation-v1') throw new Error('Unsupported simulation export format.');
  if (!payload.simulation || typeof payload.simulation !== 'object' || Array.isArray(payload.simulation)) {
    throw new Error('Simulation export is missing its simulation record.');
  }
  const source = payload.simulation as JsonRecord;
  const sourceName = typeof source.name === 'string' ? source.name.trim() : '';
  const sourceTime = typeof source.simulation_time === 'string' ? source.simulation_time : '';
  const sourceSeed = Number(source.random_seed);
  if (!sourceName || !sourceTime || !Number.isSafeInteger(sourceSeed)) throw new Error('Simulation export metadata is invalid.');

  const simulationId = crypto.randomUUID();
  const simulationResult = await client.from('simulations').insert({
    id: simulationId,
    name: (nameOverride ?? `${sourceName} import`).slice(0, 100),
    description: typeof source.description === 'string' ? source.description.slice(0, 1000) : '',
    preset_key: typeof source.preset_key === 'string' ? source.preset_key : null,
    status: 'paused',
    simulation_time: sourceTime,
    started_at: typeof source.started_at === 'string' ? source.started_at : sourceTime,
    random_seed: sourceSeed,
    config: {
      ...(source.config && typeof source.config === 'object' && !Array.isArray(source.config) ? source.config as JsonRecord : {}),
      imported: true,
      external_side_effects: false,
    },
    created_by: principal.userId,
  }).select('*').single();
  assertNoError(simulationResult.error, 'Could not create imported simulation');
  const simulation = first<SimulationRow>(simulationResult.data);

  const gameRows = importCollection(payload, 'simulation_games');
  const marketRows = importCollection(payload, 'simulation_markets');
  const playerRows = importCollection(payload, 'simulation_players');
  const forecastRows = importCollection(payload, 'simulation_forecast_versions');
  const scheduledRows = importCollection(payload, 'simulation_scheduled_forecasts');
  const snapshotRows = importCollection(payload, 'simulation_snapshots');
  const membershipRows = importCollection(payload, 'simulation_snapshot_predictions');
  const resultRows = importCollection(payload, 'simulation_results');
  const runRows = importCollection(payload, 'simulation_score_runs');
  const scoreRows = importCollection(payload, 'simulation_score_entries');

  const idMap = (collection: JsonRecord[]) => new Map(collection.map((row) => {
    if (typeof row.id !== 'string') throw new Error('Every exported row must have a UUID id.');
    return [row.id, crypto.randomUUID()];
  }));
  const gameIds = idMap(gameRows);
  const marketIds = idMap(marketRows);
  const playerIds = idMap(playerRows);
  const forecastIds = idMap(forecastRows);
  const scheduledIds = idMap(scheduledRows);
  const snapshotIds = idMap(snapshotRows);
  const resultIds = idMap(resultRows);
  const runIds = idMap(runRows);
  const scoreIds = idMap(scoreRows);

  async function insert(table: string, data: JsonRecord[]) {
    if (!data.length) return;
    const result = await client.from(table).insert(data);
    assertNoError(result.error, `Could not import ${table}`);
  }

  try {
    await insert('simulation_games', gameRows.map((row) => ({ ...row, id: mappedId(gameIds, row.id, 'game'), simulation_id: simulationId })));
    await insert('simulation_markets', marketRows.map((row) => ({
      ...row, id: mappedId(marketIds, row.id, 'market'), simulation_id: simulationId,
      game_id: mappedId(gameIds, row.game_id, 'market game'),
    })));
    await insert('simulation_players', playerRows.map((row) => ({ ...row, id: mappedId(playerIds, row.id, 'player'), simulation_id: simulationId })));
    await insert('simulation_forecast_versions', forecastRows.map((row) => ({
      ...row, id: mappedId(forecastIds, row.id, 'forecast'), simulation_id: simulationId,
      market_id: mappedId(marketIds, row.market_id, 'forecast market'),
      player_id: mappedId(playerIds, row.player_id, 'forecast player'),
    })));
    await insert('simulation_scheduled_forecasts', scheduledRows.map((row) => ({
      ...row, id: mappedId(scheduledIds, row.id, 'scheduled forecast'), simulation_id: simulationId,
      market_id: mappedId(marketIds, row.market_id, 'scheduled forecast market'),
      player_id: mappedId(playerIds, row.player_id, 'scheduled forecast player'),
    })));
    await insert('simulation_snapshots', snapshotRows.map((row) => ({
      ...row, id: mappedId(snapshotIds, row.id, 'snapshot'), simulation_id: simulationId,
      market_id: mappedId(marketIds, row.market_id, 'snapshot market'),
    })));
    await insert('simulation_snapshot_predictions', membershipRows.map((row) => ({
      ...row, simulation_id: simulationId,
      snapshot_id: mappedId(snapshotIds, row.snapshot_id, 'snapshot prediction snapshot'),
      forecast_version_id: mappedId(forecastIds, row.forecast_version_id, 'snapshot prediction forecast'),
      player_id: mappedId(playerIds, row.player_id, 'snapshot prediction player'),
    })));
    await insert('simulation_results', resultRows.map((row) => ({
      ...row, id: mappedId(resultIds, row.id, 'result'), simulation_id: simulationId,
      market_id: mappedId(marketIds, row.market_id, 'result market'), created_by: principal.userId,
    })));
    await insert('simulation_score_runs', runRows.map((row) => ({
      ...row, id: mappedId(runIds, row.id, 'score run'), simulation_id: simulationId,
      market_id: mappedId(marketIds, row.market_id, 'score run market'),
      result_id: mappedId(resultIds, row.result_id, 'score run result'), created_by: principal.userId,
    })));
    await insert('simulation_score_entries', scoreRows.map((row) => ({
      ...row, id: mappedId(scoreIds, row.id, 'score entry'), simulation_id: simulationId,
      score_run_id: mappedId(runIds, row.score_run_id, 'score entry run'),
      market_id: mappedId(marketIds, row.market_id, 'score entry market'),
      snapshot_id: mappedId(snapshotIds, row.snapshot_id, 'score entry snapshot'),
      player_id: mappedId(playerIds, row.player_id, 'score entry player'),
    })));
    await logEvent(client, simulation, principal, 'simulation_imported', {
      source_simulation_id: typeof source.id === 'string' ? source.id : null,
      games: gameRows.length,
      players: playerRows.length,
      markets: marketRows.length,
    });
    await createCheckpoint(client, simulation, principal, 'Imported state');
    return simulation;
  } catch (error) {
    const clean = await client.from('simulations').delete().eq('id', simulation.id);
    if (clean.error) {
      await client.from('simulations').update({ status: 'archived', config: { import_failed: true, external_side_effects: false } }).eq('id', simulation.id);
    }
    throw error;
  }
}

async function createCheckpoint(client: SupabaseClient, simulation: SimulationRow, principal: StagingPrincipal, name?: string) {
  const state = await exportSimulation(client, simulation.id);
  const checkpointResult = await client.from('simulation_checkpoints').insert({
    simulation_id: simulation.id,
    name: name ?? `Checkpoint ${new Date(simulation.simulation_time).toISOString()}`,
    simulation_time: simulation.simulation_time,
    state,
    created_by: principal.userId,
  }).select('*').single();
  assertNoError(checkpointResult.error, 'Could not create checkpoint');
  await logEvent(client, simulation, principal, 'checkpoint_created', {
    checkpoint_id: first<{ id: string }>(checkpointResult.data).id,
    name: name ?? null,
  });
  return checkpointResult.data;
}

async function createFromPreset(
  client: SupabaseClient,
  principal: StagingPrincipal,
  preset: SimulationPreset,
  name: string,
  seed: number,
) {
  const currentTime = new Date();
  currentTime.setUTCMinutes(0, 0, 0);
  const simulationResult = await client.from('simulations').insert({
    name: name.trim(),
    description: preset.description,
    preset_key: preset.key,
    status: 'paused',
    simulation_time: currentTime.toISOString(),
    started_at: currentTime.toISOString(),
    random_seed: seed,
    config: { preset_version: 1, external_side_effects: false },
    created_by: principal.userId,
  }).select('*').single();
  assertNoError(simulationResult.error, 'Could not create simulation');
  const simulation = first<SimulationRow>(simulationResult.data);
  try {
    const gameResult = await client.from('simulation_games').insert(
      preset.games.map((game) => ({
        simulation_id: simulation.id,
        name: game.name,
        release_at: new Date(currentTime.getTime() + game.releaseOffsetDays * 86_400_000).toISOString(),
        tags: ['Simulation', 'Steam', 'Forecasting'],
        scenario_values: game.values,
      })),
    ).select('*');
    assertNoError(gameResult.error, 'Could not create preset games');
    const games = rows<GameRow>(gameResult.data);
    const markets = games.flatMap((game) => METRICS.map((metric) => {
      const releaseAt = new Date(game.release_at ?? currentTime);
      return {
        simulation_id: simulation.id,
        game_id: game.id,
        metric_type: metric,
        status: 'open',
        lock_at: releaseAt.toISOString(),
        resolve_after: metricResolveAfter(metric, releaseAt).toISOString(),
      };
    }));
    const marketResult = await client.from('simulation_markets').insert(markets);
    assertNoError(marketResult.error, 'Could not create preset markets');
    await createPlayers(client, simulation, preset, preset.players);
    const scheduled = await scheduleForecasts(client, simulation, preset);
    await logEvent(client, simulation, principal, 'simulation_created', {
      preset: preset.key,
      seed,
      games: games.length,
      players: preset.players,
      scheduled_forecasts: scheduled,
    });
    await createCheckpoint(client, simulation, principal, 'Initial state');
    return simulation;
  } catch (error) {
    await client.from('simulations').update({ status: 'archived', config: { preset_creation_failed: true, external_side_effects: false } }).eq('id', simulation.id);
    throw error;
  }
}

export async function getGameMasterData(selectedSimulationId?: string | null) {
  const client = createStagingAdminClient();
  const simulationsResult = await client.from('simulations').select('*').order('updated_at', { ascending: false });
  assertNoError(simulationsResult.error, 'Could not list simulations');
  const simulations = rows<SimulationRow>(simulationsResult.data);
  const selectedId = selectedSimulationId && simulations.some((item) => item.id === selectedSimulationId)
    ? selectedSimulationId
    : simulations[0]?.id;
  if (!selectedId) return { presets: SIMULATION_PRESETS, simulations, selected: null };

  const simulation = simulations.find((item) => item.id === selectedId) ?? await getSimulation(client, selectedId);
  const [gamesResult, marketsResult, playersResult, forecastsResult, snapshotsResult, membershipsResult, eventsResult, checkpointsResult, resultsResult, runsResult] = await Promise.all([
    client.from('simulation_games').select('*').eq('simulation_id', selectedId).order('release_at'),
    client.from('simulation_markets').select('*').eq('simulation_id', selectedId).order('lock_at'),
    client.from('simulation_players').select('*').eq('simulation_id', selectedId).order('username'),
    client.from('simulation_forecast_versions').select('*').eq('simulation_id', selectedId).order('valid_from', { ascending: false }),
    client.from('simulation_snapshots').select('*').eq('simulation_id', selectedId).order('snapshot_at', { ascending: false }),
    client.from('simulation_snapshot_predictions').select('*').eq('simulation_id', selectedId).limit(10_000),
    client.from('simulation_events').select('*').eq('simulation_id', selectedId).order('event_at', { ascending: false }).order('id', { ascending: false }).limit(1000),
    client.from('simulation_checkpoints').select('id,name,simulation_time,created_at').eq('simulation_id', selectedId).order('created_at', { ascending: false }),
    client.from('simulation_results').select('*').eq('simulation_id', selectedId).eq('is_current', true),
    client.from('simulation_score_runs').select('*').eq('simulation_id', selectedId).eq('is_current', true).eq('formula_key', 'canonical'),
  ]);
  for (const [label, result] of Object.entries({ gamesResult, marketsResult, playersResult, forecastsResult, snapshotsResult, membershipsResult, eventsResult, checkpointsResult, resultsResult, runsResult })) {
    assertNoError(result.error, `Could not load ${label}`);
  }
  const games = rows<GameRow>(gamesResult.data);
  const markets = rows<MarketRow>(marketsResult.data);
  const players = rows<PlayerRow>(playersResult.data);
  const forecasts = rows<ForecastRow>(forecastsResult.data);
  const snapshotRows = rows<SnapshotRow>(snapshotsResult.data);
  const memberships = rows<{ snapshot_id: string; player_id: string; raw_value: number; percentile_value: number }>(membershipsResult.data);
  const runs = rows<{ id: string; market_id: string }>(runsResult.data);
  const runIds = runs.map((run) => run.id);
  const scoresResult = runIds.length
    ? await client.from('simulation_score_entries').select('*').eq('simulation_id', selectedId).in('score_run_id', runIds).limit(5000)
    : { data: [], error: null };
  assertNoError(scoresResult.error, 'Could not load simulation scores');
  const scoreEntries = rows<{
    id: string; player_id: string; market_id: string; snapshot_id: string;
    user_percentile: number; crowd_without_user_percentile: number;
    actual_percentile: number; user_error: number; crowd_error: number; points: number;
  }>(scoresResult.data);

  const snapshots = new Map(snapshotRows.map((snapshot) => [snapshot.id, snapshot]));
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const marketMap = new Map(markets.map((market) => [market.id, market]));
  const leaderboardEntries = scoreEntries.filter(
    (entry) => !isBatchSimulationPlayer(playerMap.get(entry.player_id)),
  );
  function buildLeaderboard(entries: typeof scoreEntries) {
    const aggregate = new Map<string, { playerId: string; points: number; scoredDays: Set<string>; markets: Set<string>; positive: Set<string>; negative: Set<string> }>();
    for (const entry of entries) {
      const row = aggregate.get(entry.player_id) ?? { playerId: entry.player_id, points: 0, scoredDays: new Set<string>(), markets: new Set<string>(), positive: new Set<string>(), negative: new Set<string>() };
      row.points += Number(entry.points);
      row.markets.add(entry.market_id);
      if (Number(entry.points) > 0) row.positive.add(entry.market_id);
      if (Number(entry.points) < 0) row.negative.add(entry.market_id);
      const snapshot = snapshots.get(entry.snapshot_id);
      if (snapshot) row.scoredDays.add(snapshot.snapshot_at.slice(0, 10));
      aggregate.set(entry.player_id, row);
    }
    return [...aggregate.values()].map((row) => ({
      playerId: row.playerId,
      username: playerMap.get(row.playerId)?.username ?? 'unknown',
      displayName: playerMap.get(row.playerId)?.display_name ?? 'Unknown player',
      points: row.points,
      scoredDays: row.scoredDays.size,
      resolvedMarkets: row.markets.size,
      averagePoints: row.scoredDays.size ? row.points / row.scoredDays.size : 0,
      positiveMarkets: row.positive.size,
      negativeMarkets: row.negative.size,
    })).sort((left, right) => right.points - left.points || right.scoredDays - left.scoredDays)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
  const leaderboard = buildLeaderboard(leaderboardEntries);
  const leaderboardByMetric = Object.fromEntries(['all', ...METRICS].map((metric) => [
    metric,
    buildLeaderboard(metric === 'all'
      ? leaderboardEntries
      : leaderboardEntries.filter((entry) => marketMap.get(entry.market_id)?.metric_type === metric)),
  ]));

  const comparisonDefinitions = [
    { key: 'canonical', label: 'Canonical improvement', value: (entry: typeof scoreEntries[number]) => Number(entry.points) },
    { key: 'absolute_accuracy', label: 'Absolute accuracy', value: (entry: typeof scoreEntries[number]) => Math.max(0, 100 - Number(entry.user_error)) },
    { key: 'squared_improvement', label: 'Squared improvement', value: (entry: typeof scoreEntries[number]) => (Number(entry.crowd_error) ** 2 - Number(entry.user_error) ** 2) / 100 },
  ];
  const formulaComparison = comparisonDefinitions.map((formula) => {
    const totals = new Map<string, number>();
    for (const entry of leaderboardEntries) totals.set(entry.player_id, (totals.get(entry.player_id) ?? 0) + formula.value(entry));
    return {
      formulaKey: formula.key,
      label: formula.label,
      leaderboard: [...totals.entries()]
        .map(([playerId, points]) => ({
          playerId,
          username: playerMap.get(playerId)?.username ?? 'unknown',
          displayName: playerMap.get(playerId)?.display_name ?? 'Unknown player',
          points,
        }))
        .sort((left, right) => right.points - left.points)
        .map((row, index) => ({ ...row, rank: index + 1 })),
    };
  });

  const gameMap = new Map(games.map((game) => [game.id, game]));
  const snapshotTimeMap = new Map(snapshotRows.map((snapshot) => [snapshot.id, snapshot.snapshot_at]));
  const scoreInspector = scoreEntries.slice(0, 250).map((entry) => {
    const market = marketMap.get(entry.market_id);
    return {
      ...entry,
      player: playerMap.get(entry.player_id)?.username ?? 'unknown',
      metric: market?.metric_type ?? 'unknown',
      game: market ? gameMap.get(market.game_id)?.name ?? 'Unknown game' : 'Unknown game',
      snapshotTime: snapshotTimeMap.get(entry.snapshot_id) ?? null,
    };
  });
  const scheduledResult = await client.from('simulation_scheduled_forecasts').select('id,scheduled_at').eq('simulation_id', selectedId).is('processed_at', null).order('scheduled_at').limit(1);
  assertNoError(scheduledResult.error, 'Could not load next event');
  const membershipsBySnapshot = new Map<string, typeof memberships>();
  for (const membership of memberships) {
    const collection = membershipsBySnapshot.get(membership.snapshot_id) ?? [];
    collection.push(membership);
    membershipsBySnapshot.set(membership.snapshot_id, collection);
  }
  const snapshotStats = snapshotRows.map((snapshot) => {
    const values = (membershipsBySnapshot.get(snapshot.id) ?? []).map((member) => Number(member.raw_value)).sort((left, right) => left - right);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const middle = Math.floor(values.length / 2);
    const median = values.length ? (values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2) : null;
    const variance = mean === null ? null : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return { ...snapshot, mean, median, minimum: values[0] ?? null, maximum: values.at(-1) ?? null, standardDeviation: variance === null ? null : Math.sqrt(variance), status: scoreEntries.some((entry) => entry.snapshot_id === snapshot.id) ? 'scored' : 'unscored' };
  });
  const currentResults = new Map(rows<{ market_id: string; actual_raw_value: number }>(resultsResult.data).map((result) => [result.market_id, result]));
  const marketStats = Object.fromEntries(markets.map((market) => {
    const active = forecasts.filter((forecast) => forecast.market_id === market.id && forecast.valid_to === null);
    const participantCount = new Set(active.map((forecast) => forecast.player_id)).size;
    const currentForecast = active.length ? active.reduce((sum, forecast) => sum + Number(forecast.raw_value), 0) / active.length : null;
    return [market.id, {
      participantCount,
      currentForecast,
      snapshotCount: snapshotRows.filter((snapshot) => snapshot.market_id === market.id).length,
      actualResult: currentResults.get(market.id)?.actual_raw_value ?? null,
      scoringStatus: runs.some((run) => run.market_id === market.id) ? 'scored' : 'not_scored',
    }];
  }));

  return {
    presets: SIMULATION_PRESETS,
    simulations,
    selected: {
      simulation,
      games,
      markets,
      players,
      forecasts,
      snapshots: snapshotRows,
      snapshotStats,
      results: resultsResult.data ?? [],
      events: eventsResult.data ?? [],
      checkpoints: checkpointsResult.data ?? [],
      leaderboard,
      leaderboardByMetric,
      marketStats,
      formulaComparison,
      scoreInspector,
      nextScheduledAt: rows<{ scheduled_at: string }>(scheduledResult.data)[0]?.scheduled_at ?? null,
    },
  };
}

export async function executeSimulationCommand(command: SimulationCommand, principal: StagingPrincipal) {
  const client = createStagingAdminClient();
  if (command.action === 'create') {
    const preset = getPreset(command.presetKey);
    const seed = Number.isSafeInteger(command.seed) ? Number(command.seed) : Date.now() % 2_147_483_647;
    return createFromPreset(client, principal, preset, command.name, seed);
  }
  if (command.action === 'create_blank') {
    const currentTime = command.startAt ? new Date(command.startAt) : new Date();
    if (!Number.isFinite(currentTime.getTime())) throw new Error('Simulation start time is invalid.');
    if (!command.startAt) currentTime.setUTCMinutes(0, 0, 0);
    const seed = Number.isSafeInteger(command.seed) ? Number(command.seed) : Date.now() % 2_147_483_647;
    const result = await client.from('simulations').insert({
      name: command.name.trim(),
      description: command.description?.trim() || 'Blank designer-controlled simulation.',
      preset_key: null,
      status: 'paused',
      simulation_time: currentTime.toISOString(),
      started_at: currentTime.toISOString(),
      random_seed: seed,
      config: { blank: true, external_side_effects: false },
      created_by: principal.userId,
    }).select('*').single();
    assertNoError(result.error, 'Could not create blank simulation');
    const simulation = first<SimulationRow>(result.data);
    await logEvent(client, simulation, principal, 'simulation_created', { blank: true, seed });
    await createCheckpoint(client, simulation, principal, 'Initial state');
    return simulation;
  }
  if (command.action === 'import') return importSimulation(client, principal, command.payload);

  const simulation = await getSimulation(client, command.simulationId);
  if (simulation.status === 'archived' && command.action !== 'clone' && command.action !== 'clone_checkpoint') throw new Error('Archived simulations are read-only.');

  switch (command.action) {
    case 'run':
    case 'pause': {
      const status = command.action === 'run' ? 'running' : 'paused';
      const result = await client.from('simulations').update({ status }).eq('id', simulation.id);
      assertNoError(result.error, `Could not ${command.action} simulation`);
      await logEvent(client, simulation, principal, `simulation_${command.action}`);
      return { status };
    }
    case 'archive': {
      const result = await client.from('simulations').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', simulation.id);
      assertNoError(result.error, 'Could not archive simulation');
      await logEvent(client, simulation, principal, 'simulation_archived');
      return { status: 'archived' };
    }
    case 'advance': {
      const target = advanceClock(simulation.simulation_time, command.seconds);
      return advanceSimulation(client, simulation, target, principal);
    }
    case 'set_time': {
      const target = new Date(command.at);
      if (!Number.isFinite(target.getTime())) throw new Error('Simulation time is invalid.');
      if (target < new Date(simulation.simulation_time)) {
        throw new Error('Simulation time can only move forward. Restore a checkpoint to revisit earlier state.');
      }
      return advanceSimulation(client, simulation, target, principal);
    }
    case 'advance_to_lock':
    case 'advance_to_resolution': {
      const isLock = command.action === 'advance_to_lock';
      const column = isLock ? 'lock_at' : 'resolve_after';
      const status = isLock ? 'open' : 'locked';
      const next = await client
        .from('simulation_markets')
        .select(column)
        .eq('simulation_id', simulation.id)
        .eq('status', status)
        .not(column, 'is', null)
        .gt(column, simulation.simulation_time)
        .order(column)
        .limit(1);
      assertNoError(next.error, isLock ? 'Could not inspect market locks' : 'Could not inspect market resolutions');
      const value = rows<Record<string, string>>(next.data)[0]?.[column];
      if (!value) throw new Error(isLock ? 'There is no future market lock.' : 'There is no future resolution time.');
      return advanceSimulation(client, simulation, new Date(value), principal);
    }
    case 'next_event': {
      const [scheduled, locks, resolutions] = await Promise.all([
        client.from('simulation_scheduled_forecasts').select('scheduled_at').eq('simulation_id', simulation.id).is('processed_at', null).gt('scheduled_at', simulation.simulation_time).order('scheduled_at').limit(1),
        client.from('simulation_markets').select('lock_at').eq('simulation_id', simulation.id).eq('status', 'open').not('lock_at', 'is', null).gt('lock_at', simulation.simulation_time).order('lock_at').limit(1),
        client.from('simulation_markets').select('resolve_after').eq('simulation_id', simulation.id).eq('status', 'locked').not('resolve_after', 'is', null).gt('resolve_after', simulation.simulation_time).order('resolve_after').limit(1),
      ]);
      assertNoError(scheduled.error, 'Could not inspect scheduled events');
      assertNoError(locks.error, 'Could not inspect market locks');
      assertNoError(resolutions.error, 'Could not inspect resolutions');
      const candidates = [
        rows<{ scheduled_at: string }>(scheduled.data)[0]?.scheduled_at,
        rows<{ lock_at: string }>(locks.data)[0]?.lock_at,
        rows<{ resolve_after: string }>(resolutions.data)[0]?.resolve_after,
      ].filter((value): value is string => Boolean(value)).map((value) => new Date(value));
      if (!candidates.length) throw new Error('There are no future simulation events.');
      const target = new Date(Math.min(...candidates.map((date) => date.getTime())));
      return advanceSimulation(client, simulation, target, principal);
    }
    case 'generate_players': {
      const preset = getPreset(simulation.preset_key ?? 'market_predicts_correctly');
      const created = await createPlayers(client, simulation, preset, Math.max(1, Math.min(command.count, 500)), command);
      await logEvent(client, simulation, principal, 'players_generated', { count: created.length, prefix: command.prefix ?? null, behavior: command.behavior ?? 'mixed', skill_min: command.skillMin ?? null, skill_max: command.skillMax ?? null });
      return { count: created.length };
    }
    case 'generate_forecasts': {
      const preset = getPreset(simulation.preset_key ?? 'market_predicts_correctly');
      const count = await scheduleForecasts(client, simulation, preset, Math.max(0.01, Math.min(command.density ?? 1, 1)), command);
      await logEvent(client, simulation, principal, 'forecasts_scheduled', { count, market_id: command.marketId ?? null, distribution: command.distribution ?? 'around_actual', timing: command.timing ?? 'behavior' }, command.marketId);
      return { count };
    }
    case 'snapshot': {
      const at = command.at ? new Date(command.at) : new Date(simulation.simulation_time);
      if (at > new Date(simulation.simulation_time)) throw new Error('Snapshot cannot be ahead of the simulation clock.');
      const count = await createSnapshot(client, simulation, at);
      await logEvent(client, simulation, principal, 'snapshots_created', { at: at.toISOString(), count });
      return { count };
    }
    case 'snapshot_batch': {
      const until = new Date(command.until);
      const now = new Date(simulation.simulation_time);
      if (!Number.isFinite(until.getTime()) || until > now) throw new Error('Snapshot batch cannot run ahead of the simulation clock.');
      let cursor = new Date(simulation.started_at ?? simulation.simulation_time);
      cursor.setUTCHours(24, 0, 0, 0);
      let count = 0;
      let days = 0;
      while (cursor <= until && days < 366) {
        count += await createSnapshot(client, simulation, cursor);
        cursor = new Date(cursor.getTime() + 86_400_000);
        days += 1;
      }
      if (cursor <= until) throw new Error('Snapshot batches are limited to 366 days.');
      await logEvent(client, simulation, principal, 'snapshot_batch_completed', { until: until.toISOString(), days, count });
      return { count, days };
    }
    case 'delete_latest_snapshot': {
      let query = client.from('simulation_snapshots').select('id,market_id,snapshot_at').eq('simulation_id', simulation.id).order('snapshot_at', { ascending: false }).limit(1);
      if (command.marketId) query = query.eq('market_id', command.marketId);
      const latest = await query.maybeSingle();
      assertNoError(latest.error, 'Could not find latest snapshot');
      if (!latest.data) throw new Error('There is no snapshot to delete.');
      const scored = await client.from('simulation_score_entries').select('id', { count: 'exact', head: true }).eq('snapshot_id', latest.data.id);
      assertNoError(scored.error, 'Could not inspect snapshot scores');
      if ((scored.count ?? 0) > 0) throw new Error('Scored snapshots are immutable. Reset scores or the market first.');
      const members = await client.from('simulation_snapshot_predictions').delete().eq('snapshot_id', latest.data.id);
      assertNoError(members.error, 'Could not delete snapshot members');
      const removed = await client.from('simulation_snapshots').delete().eq('id', latest.data.id);
      assertNoError(removed.error, 'Could not delete snapshot');
      await logEvent(client, simulation, principal, 'snapshot_deleted', { snapshot_id: latest.data.id, snapshot_at: latest.data.snapshot_at }, latest.data.market_id);
      return { deleted: latest.data.id };
    }
    case 'rebuild_snapshots': {
      const scored = await client.from('simulation_score_entries').select('id', { count: 'exact', head: true }).eq('simulation_id', simulation.id);
      assertNoError(scored.error, 'Could not inspect existing scores');
      if ((scored.count ?? 0) > 0) throw new Error('Reset scores before rebuilding snapshots.');
      const snapshotResult = await client.from('simulation_snapshots').select('id').eq('simulation_id', simulation.id);
      assertNoError(snapshotResult.error, 'Could not inspect snapshots');
      const ids = rows<{ id: string }>(snapshotResult.data).map((row) => row.id);
      if (ids.length) {
        const members = await client.from('simulation_snapshot_predictions').delete().in('snapshot_id', ids);
        assertNoError(members.error, 'Could not clear snapshot members');
      }
      const removed = await client.from('simulation_snapshots').delete().eq('simulation_id', simulation.id);
      assertNoError(removed.error, 'Could not clear snapshots');
      let cursor = new Date(simulation.started_at ?? simulation.simulation_time);
      cursor.setUTCHours(24, 0, 0, 0);
      const until = new Date(simulation.simulation_time);
      let count = 0;
      let days = 0;
      while (cursor <= until && days < 366) {
        count += await createSnapshot(client, simulation, cursor);
        cursor = new Date(cursor.getTime() + 86_400_000);
        days += 1;
      }
      await logEvent(client, simulation, principal, 'snapshots_rebuilt', { days, count });
      return { count, days };
    }
    case 'create_game': {
      const releaseAt = command.releaseAt ? new Date(command.releaseAt) : new Date(new Date(simulation.simulation_time).getTime() + 30 * 86_400_000);
      if (!Number.isFinite(releaseAt.getTime())) throw new Error('Release date is invalid.');
      const gameResult = await client.from('simulation_games').insert({
        simulation_id: simulation.id,
        name: command.name.trim(),
        release_at: releaseAt.toISOString(),
        tags: ['Manual scenario'],
        scenario_values: command.scenarioValues,
      }).select('*').single();
      assertNoError(gameResult.error, 'Could not create simulation game');
      const game = first<GameRow>(gameResult.data);
      let marketCount = 0;
      if (command.createMarkets !== false) {
        const marketResult = await client.from('simulation_markets').insert(METRICS.map((metric) => ({
          simulation_id: simulation.id,
          game_id: game.id,
          metric_type: metric,
          status: 'open',
          lock_at: releaseAt.toISOString(),
          resolve_after: metricResolveAfter(metric, releaseAt).toISOString(),
        })));
        assertNoError(marketResult.error, 'Could not create markets for simulation game');
        marketCount = METRICS.length;
      }
      await logEvent(client, simulation, principal, 'game_created', { game_id: game.id, name: game.name, markets: marketCount });
      return { game, marketCount };
    }
    case 'clone_catalog_game': {
      const catalogResult = await client.from('steam_games').select('steam_app_id,name,image_url,release_date,tags').eq('steam_app_id', command.steamAppId).single();
      assertNoError(catalogResult.error, 'Staging catalog game not found');
      const catalog = first<{ steam_app_id: number; name: string; image_url: string; release_date: string | null; tags: string[] }>(catalogResult.data);
      const releaseAt = catalog.release_date ? new Date(`${catalog.release_date}T00:00:00.000Z`) : new Date(new Date(simulation.simulation_time).getTime() + 30 * 86_400_000);
      const gameResult = await client.from('simulation_games').insert({
        simulation_id: simulation.id,
        steam_app_id: catalog.steam_app_id,
        name: catalog.name,
        release_at: releaseAt.toISOString(),
        hero_url: catalog.image_url,
        tags: (catalog.tags ?? []).slice(0, 10),
        scenario_values: command.scenarioValues,
      }).select('*').single();
      assertNoError(gameResult.error, 'Could not clone catalog game');
      const game = first<GameRow>(gameResult.data);
      const marketResult = await client.from('simulation_markets').insert(METRICS.map((metric) => ({
        simulation_id: simulation.id, game_id: game.id, metric_type: metric, status: 'open',
        lock_at: releaseAt.toISOString(), resolve_after: metricResolveAfter(metric, releaseAt).toISOString(),
      })));
      assertNoError(marketResult.error, 'Could not create markets for cloned catalog game');
      await logEvent(client, simulation, principal, 'catalog_game_cloned', { game_id: game.id, steam_app_id: catalog.steam_app_id, name: catalog.name, markets: METRICS.length });
      return { game, marketCount: METRICS.length };
    }
    case 'update_game': {
      const current = await client.from('simulation_games').select('*').eq('simulation_id', simulation.id).eq('id', command.gameId).single();
      assertNoError(current.error, 'Simulation game not found');
      const changes: { name?: string; release_at?: string } = {};
      if (command.name) changes.name = command.name.trim();
      if (command.releaseAt) changes.release_at = new Date(command.releaseAt).toISOString();
      const saved = await client.from('simulation_games').update(changes).eq('simulation_id', simulation.id).eq('id', command.gameId).select('*').single();
      assertNoError(saved.error, 'Could not update simulation game');
      if (command.releaseAt) {
        const releaseAt = new Date(command.releaseAt);
        for (const metric of METRICS) {
          const timing = await client.from('simulation_markets').update({ lock_at: releaseAt.toISOString(), resolve_after: metricResolveAfter(metric, releaseAt).toISOString() }).eq('simulation_id', simulation.id).eq('game_id', command.gameId).eq('metric_type', metric).in('status', ['open', 'locked']);
          assertNoError(timing.error, 'Could not update market timing');
        }
      }
      await logEvent(client, simulation, principal, 'game_updated', { game_id: command.gameId, name: command.name ?? null, release_at: command.releaseAt ?? null });
      return saved.data;
    }
    case 'create_market': {
      const gameResult = await client.from('simulation_games').select('id,release_at').eq('simulation_id', simulation.id).eq('id', command.gameId).single();
      assertNoError(gameResult.error, 'Simulation game not found');
      const game = first<{ id: string; release_at: string | null }>(gameResult.data);
      const lockAt = command.lockAt ? new Date(command.lockAt) : new Date(game.release_at ?? new Date(simulation.simulation_time).getTime() + 30 * 86_400_000);
      const resolveAfter = command.resolveAfter ? new Date(command.resolveAfter) : metricResolveAfter(command.metricType, lockAt);
      if (!Number.isFinite(lockAt.getTime()) || !Number.isFinite(resolveAfter.getTime())) throw new Error('Market timing is invalid.');
      const marketResult = await client.from('simulation_markets').insert({
        simulation_id: simulation.id,
        game_id: command.gameId,
        metric_type: command.metricType,
        status: 'open',
        lock_at: lockAt.toISOString(),
        resolve_after: resolveAfter.toISOString(),
      }).select('*').single();
      assertNoError(marketResult.error, 'Could not create simulation market');
      const market = first<MarketRow>(marketResult.data);
      await logEvent(client, simulation, principal, 'market_created', { metric_type: market.metric_type }, market.id);
      return market;
    }
    case 'submit_forecast': {
      const at = command.at ? new Date(command.at) : new Date(simulation.simulation_time);
      if (!Number.isFinite(at.getTime()) || at > new Date(simulation.simulation_time)) throw new Error('Forecast time must not be ahead of the simulation clock.');
      const [marketResult, playerResult, activeResult] = await Promise.all([
        client.from('simulation_markets').select('*').eq('simulation_id', simulation.id).eq('id', command.marketId).single(),
        client.from('simulation_players').select('id').eq('simulation_id', simulation.id).eq('id', command.playerId).single(),
        client.from('simulation_forecast_versions').select('id,valid_from').eq('simulation_id', simulation.id).eq('market_id', command.marketId).eq('player_id', command.playerId).is('valid_to', null).maybeSingle(),
      ]);
      assertNoError(marketResult.error, 'Simulation market not found');
      assertNoError(playerResult.error, 'Simulation player not found');
      assertNoError(activeResult.error, 'Could not inspect current forecast');
      const market = first<MarketRow>(marketResult.data);
      if (market.status !== 'open' || (market.lock_at && at >= new Date(market.lock_at))) throw new Error('Forecasts are closed for this market.');
      const active = activeResult.data as { id: string; valid_from: string } | null;
      if (active && at < new Date(active.valid_from)) throw new Error('Forecast time cannot precede the current forecast version.');
      if (active) {
        const close = await client.from('simulation_forecast_versions').update({ valid_to: at.toISOString() }).eq('id', active.id);
        assertNoError(close.error, 'Could not close current forecast version');
      }
      const saved = await client.from('simulation_forecast_versions').insert({
        simulation_id: simulation.id,
        market_id: market.id,
        player_id: command.playerId,
        raw_value: command.rawValue,
        percentile_value: percentileValue(market.metric_type, command.rawValue),
        valid_from: at.toISOString(),
        source: 'game-master',
      }).select('*').single();
      assertNoError(saved.error, 'Could not submit forecast');
      await logEvent(client, simulation, principal, active ? 'forecast_edited' : 'forecast_created', { raw_value: command.rawValue }, market.id, command.playerId);
      return saved.data;
    }
    case 'delete_forecast': {
      const forecastResult = await client.from('simulation_forecast_versions').select('*').eq('simulation_id', simulation.id).eq('id', command.forecastId).single();
      assertNoError(forecastResult.error, 'Forecast version not found');
      const forecast = first<ForecastRow>(forecastResult.data);
      const scored = await client.from('simulation_snapshot_predictions').select('snapshot_id').eq('forecast_version_id', forecast.id);
      assertNoError(scored.error, 'Could not inspect forecast usage');
      if (rows(scored.data).length) throw new Error('Forecast versions used by a snapshot are immutable.');
      const removed = await client.from('simulation_forecast_versions').delete().eq('id', forecast.id);
      assertNoError(removed.error, 'Could not delete forecast version');
      await logEvent(client, simulation, principal, 'forecast_deleted', { forecast_id: forecast.id }, forecast.market_id, forecast.player_id);
      return { deleted: forecast.id };
    }
    case 'reset_player': {
      const snapshotForecasts = await client.from('simulation_snapshot_predictions').select('forecast_version_id').eq('simulation_id', simulation.id).eq('player_id', command.playerId);
      assertNoError(snapshotForecasts.error, 'Could not inspect player snapshots');
      if (rows(snapshotForecasts.data).length) throw new Error('Player has snapshotted forecasts. Reset affected markets first.');
      const scheduled = await client.from('simulation_scheduled_forecasts').delete().eq('simulation_id', simulation.id).eq('player_id', command.playerId);
      assertNoError(scheduled.error, 'Could not clear player scheduled forecasts');
      const forecasts = await client.from('simulation_forecast_versions').delete().eq('simulation_id', simulation.id).eq('player_id', command.playerId);
      assertNoError(forecasts.error, 'Could not clear player forecasts');
      await logEvent(client, simulation, principal, 'player_reset', {}, undefined, command.playerId);
      return { reset: command.playerId };
    }
    case 'disable_player': {
      const playerResult = await client.from('simulation_players').select('metadata').eq('simulation_id', simulation.id).eq('id', command.playerId).single();
      assertNoError(playerResult.error, 'Simulation player not found');
      const metadata = { ...first<{ metadata: JsonRecord }>(playerResult.data).metadata, disabled: true, disabled_at: simulation.simulation_time };
      const saved = await client.from('simulation_players').update({ metadata }).eq('id', command.playerId);
      assertNoError(saved.error, 'Could not disable simulation player');
      await logEvent(client, simulation, principal, 'player_disabled', {}, undefined, command.playerId);
      return { disabled: command.playerId };
    }
    case 'lock': {
      const result = await client.from('simulation_markets').update({ status: 'locked' }).eq('simulation_id', simulation.id).eq('id', command.marketId).eq('status', 'open').select('id').single();
      assertNoError(result.error, 'Open simulation market not found');
      await logEvent(client, simulation, principal, 'market_locked', { manual: true }, command.marketId);
      return { status: 'locked' };
    }
    case 'unlock':
    case 'open_market': {
      const existingResults = await client.from('simulation_results').select('id', { count: 'exact', head: true }).eq('simulation_id', simulation.id).eq('market_id', command.marketId);
      assertNoError(existingResults.error, 'Could not inspect market results');
      if ((existingResults.count ?? 0) > 0) throw new Error('Resolved markets cannot be reopened. Reset the market first.');
      const saved = await client.from('simulation_markets').update({ status: 'open', void_reason: null }).eq('simulation_id', simulation.id).eq('id', command.marketId).select('id').single();
      assertNoError(saved.error, 'Simulation market not found');
      await logEvent(client, simulation, principal, command.action === 'unlock' ? 'market_unlocked' : 'market_opened', {}, command.marketId);
      return { status: 'open' };
    }
    case 'reset_scores': {
      const cleared = await client.from('simulation_score_runs').delete().eq('simulation_id', simulation.id).eq('market_id', command.marketId);
      assertNoError(cleared.error, 'Could not reset market scores');
      await logEvent(client, simulation, principal, 'scores_reset', {}, command.marketId);
      return { reset: 'scores' };
    }
    case 'reset_market': {
      await clearMarketData(client, simulation.id, command.marketId, true);
      const reset = await client.from('simulation_markets').update({ status: 'open', void_reason: null }).eq('simulation_id', simulation.id).eq('id', command.marketId).select('id').single();
      assertNoError(reset.error, 'Simulation market not found');
      await logEvent(client, simulation, principal, 'market_reset', {}, command.marketId);
      return { status: 'open' };
    }
    case 'delete_market': {
      await clearMarketData(client, simulation.id, command.marketId, true);
      const removed = await client.from('simulation_markets').delete().eq('simulation_id', simulation.id).eq('id', command.marketId).select('id').single();
      assertNoError(removed.error, 'Simulation market not found');
      await logEvent(client, simulation, principal, 'market_deleted', {}, command.marketId);
      return { deleted: command.marketId };
    }
    case 'signal': {
      let forecastEdits = 0;
      if (command.marketId && command.targetValue !== undefined) {
        const marketResult = await client.from('simulation_markets').select('*').eq('simulation_id', simulation.id).eq('id', command.marketId).eq('status', 'open').single();
        assertNoError(marketResult.error, 'Open simulation market not found');
        const market = first<MarketRow>(marketResult.data);
        const playersResult = await client.from('simulation_players').select('*').eq('simulation_id', simulation.id);
        assertNoError(playersResult.error, 'Could not load signal players');
        const affected = new Set(command.affectedBehaviors ?? ['follower', 'late']);
        const strength = command.strength ?? 0.6;
        for (const player of rows<PlayerRow>(playersResult.data).filter((row) => affected.has(row.behavior))) {
          const activeResult = await client.from('simulation_forecast_versions').select('*').eq('simulation_id', simulation.id).eq('market_id', market.id).eq('player_id', player.id).is('valid_to', null).maybeSingle();
          assertNoError(activeResult.error, 'Could not inspect signal forecast');
          const active = activeResult.data as ForecastRow | null;
          const rawValue = Math.max(0, Number(active?.raw_value ?? command.targetValue) + (command.targetValue - Number(active?.raw_value ?? command.targetValue)) * strength);
          if (active) {
            const close = await client.from('simulation_forecast_versions').update({ valid_to: simulation.simulation_time }).eq('id', active.id);
            assertNoError(close.error, 'Could not close signal forecast');
          }
          const saved = await client.from('simulation_forecast_versions').insert({ simulation_id: simulation.id, market_id: market.id, player_id: player.id, raw_value: rawValue, percentile_value: percentileValue(market.metric_type, rawValue), valid_from: simulation.simulation_time, source: `signal:${command.label.trim()}` });
          assertNoError(saved.error, 'Could not create signal forecast');
          forecastEdits += 1;
        }
      }
      const config = { ...simulation.config, last_external_signal: { label: command.label.trim(), description: command.description ?? null, value: command.value ?? null, target_value: command.targetValue ?? null, strength: command.strength ?? null, at: simulation.simulation_time } };
      const result = await client.from('simulations').update({ config }).eq('id', simulation.id);
      assertNoError(result.error, 'Could not apply external signal');
      await logEvent(client, simulation, principal, 'external_signal', { label: command.label.trim(), description: command.description ?? null, value: command.value ?? null, target_value: command.targetValue ?? null, strength: command.strength ?? null, forecast_edits: forecastEdits }, command.marketId);
      return { applied: true, forecastEdits };
    }
    case 'resolve':
    case 'correct':
      return resolveMarket(client, simulation, command.marketId, command.actualValue, principal, command.note);
    case 'void': {
      if (!command.reason.trim()) throw new Error('Void reason is required.');
      const result = await client.from('simulation_markets').update({ status: 'void', void_reason: command.reason.trim() }).eq('simulation_id', simulation.id).eq('id', command.marketId);
      assertNoError(result.error, 'Could not void market');
      await logEvent(client, simulation, principal, 'market_voided', { reason: command.reason.trim() }, command.marketId);
      return { status: 'void' };
    }
    case 'checkpoint':
      return createCheckpoint(client, simulation, principal);
    case 'reset': {
      let checkpointQuery = client.from('simulation_checkpoints').select('*').eq('simulation_id', simulation.id);
      checkpointQuery = command.checkpointId
        ? checkpointQuery.eq('id', command.checkpointId)
        : checkpointQuery.order('created_at').limit(1);
      const checkpointResult = await checkpointQuery.single();
      assertNoError(checkpointResult.error, command.checkpointId ? 'Checkpoint not found in this simulation' : 'Initial checkpoint not found');
      const checkpoint = first<{ id: string; state: JsonRecord; simulation_time: string }>(checkpointResult.data);
      const state = checkpoint.state;
      const marketResult = await client.from('simulation_markets').select('id').eq('simulation_id', simulation.id);
      assertNoError(marketResult.error, 'Could not inspect markets before reset');
      for (const market of rows<{ id: string }>(marketResult.data)) await clearMarketData(client, simulation.id, market.id, true);
      const removeGames = await client.from('simulation_games').delete().eq('simulation_id', simulation.id);
      assertNoError(removeGames.error, 'Could not clear simulation games');
      const removePlayers = await client.from('simulation_players').delete().eq('simulation_id', simulation.id);
      assertNoError(removePlayers.error, 'Could not clear simulation players');
      for (const table of EXPORT_TABLES) {
        const data = Array.isArray(state[table]) ? state[table] : [];
        if (data.length) {
          const restored = await client.from(table).insert(data);
          assertNoError(restored.error, `Could not restore ${table}`);
        }
      }
      const update = await client.from('simulations').update({ simulation_time: checkpoint.simulation_time, status: 'paused' }).eq('id', simulation.id);
      assertNoError(update.error, 'Could not reset simulation clock');
      await logEvent(client, { ...simulation, simulation_time: checkpoint.simulation_time }, principal, 'simulation_reset', { checkpoint_id: checkpoint.id, checkpoint_time: checkpoint.simulation_time });
      return { resetAt: checkpoint.simulation_time };
    }
    case 'clone_checkpoint': {
      const checkpointResult = await client.from('simulation_checkpoints').select('id,name,state').eq('simulation_id', simulation.id).eq('id', command.checkpointId).single();
      assertNoError(checkpointResult.error, 'Checkpoint not found in this simulation');
      const checkpoint = first<{ id: string; name: string; state: JsonRecord }>(checkpointResult.data);
      const cloned = await importSimulation(client, principal, checkpoint.state, `${simulation.name} · ${checkpoint.name}`);
      await logEvent(client, cloned, principal, 'simulation_cloned_from_checkpoint', { source_simulation_id: simulation.id, checkpoint_id: checkpoint.id });
      return cloned;
    }
    case 'clone': {
      const state = await exportSimulation(client, simulation.id);
      const cloned = await importSimulation(client, principal, state, `${simulation.name} copy`);
      await logEvent(client, cloned, principal, 'simulation_cloned', { source_simulation_id: simulation.id });
      return cloned;
    }
    case 'impersonate': {
      const playerResult = await client.from('simulation_players').select('id,username').eq('simulation_id', simulation.id).eq('id', command.playerId).single();
      assertNoError(playerResult.error, 'Simulation player not found');
      const player = first<{ id: string; username: string }>(playerResult.data);
      await logEvent(client, simulation, principal, 'player_impersonated', { username: player.username }, undefined, player.id);
      return { playerId: player.id, username: player.username };
    }
    case 'end_impersonate': {
      const playerResult = await client.from('simulation_players').select('id,username').eq('simulation_id', simulation.id).eq('id', command.playerId).single();
      assertNoError(playerResult.error, 'Simulation player not found');
      const player = first<{ id: string; username: string }>(playerResult.data);
      await logEvent(client, simulation, principal, 'player_impersonation_ended', { username: player.username }, undefined, player.id);
      return { ended: player.id };
    }
  }
}

type SimulationDownloadFormat = 'json' | 'csv' | 'forecasts_csv' | 'snapshots_csv' | 'scores_csv';

function csvCell(value: unknown) {
  const normalized = value === null || value === undefined
    ? ''
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function recordsToCsv(records: JsonRecord[], columns: string[]) {
  return [columns.join(','), ...records.map((record) => columns.map((column) => csvCell(record[column])).join(','))].join('\n');
}

export async function downloadSimulation(simulationId: string, format: SimulationDownloadFormat) {
  const client = createStagingAdminClient();
  const exported = await exportSimulation(client, simulationId);
  const exportedCollections = exported as typeof exported & Record<(typeof EXPORT_TABLES)[number], JsonRecord[]>;
  const data = await getGameMasterData(simulationId);
  const selected = data.selected;
  if (format === 'json') {
    const [events, checkpoints] = await Promise.all([
      client.from('simulation_events').select('*').eq('simulation_id', simulationId).order('id'),
      client.from('simulation_checkpoints').select('id,name,simulation_time,created_at').eq('simulation_id', simulationId).order('created_at'),
    ]);
    assertNoError(events.error, 'Could not export simulation events');
    assertNoError(checkpoints.error, 'Could not export checkpoint manifest');
    return JSON.stringify({
      ...exported,
      simulation_events: events.data ?? [],
      checkpoint_manifest: checkpoints.data ?? [],
      leaderboard: selected?.leaderboard ?? [],
      leaderboard_by_metric: selected?.leaderboardByMetric ?? {},
    }, null, 2);
  }

  if (format === 'forecasts_csv') {
    return recordsToCsv(exportedCollections.simulation_forecast_versions, ['id', 'simulation_id', 'market_id', 'player_id', 'raw_value', 'percentile_value', 'valid_from', 'valid_to', 'source', 'created_at']);
  }
  if (format === 'snapshots_csv') {
    return recordsToCsv(exportedCollections.simulation_snapshots, ['id', 'simulation_id', 'market_id', 'snapshot_at', 'eligible_prediction_count', 'crowd_percentile', 'created_at']);
  }
  if (format === 'scores_csv') {
    return recordsToCsv(exportedCollections.simulation_score_entries, ['id', 'simulation_id', 'score_run_id', 'market_id', 'snapshot_id', 'player_id', 'user_percentile', 'crowd_without_user_percentile', 'actual_percentile', 'user_error', 'crowd_error', 'points', 'created_at']);
  }
  return recordsToCsv((selected?.leaderboard ?? []).map((row) => ({
    rank: row.rank,
    username: row.username,
    display_name: row.displayName,
    points: row.points,
    scored_days: row.scoredDays,
    resolved_markets: row.resolvedMarkets,
    average_points: row.averagePoints,
    positive_markets: row.positiveMarkets,
    negative_markets: row.negativeMarkets,
  })), ['rank', 'username', 'display_name', 'points', 'scored_days', 'resolved_markets', 'average_points', 'positive_markets', 'negative_markets']);
}
