import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { getRoleAdminData, grantGameDesigner, revokeGameDesigner, revokePendingAssignment } from './role-admin-service';
import { downloadSimulation, executeSimulationCommand, getGameMasterData } from './simulation-service';

const runIntegration = process.env.RUN_STAGING_INTEGRATION === 'true';

describe.skipIf(!runIntegration)('staging simulation service integration', () => {
  it('runs a deterministic simulation through forecasts, snapshots, lock, resolution, correction and scoring', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) throw new Error('Staging integration environment is missing.');
    const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const email = `integration-${Date.now()}@test.local`;
    const created = await admin.auth.admin.createUser({
      email,
      password: 'Test-password-123!',
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error ?? new Error('Could not create integration user.');
    const principal = { userId: created.data.user.id, email, role: 'root' as const, isRoot: true };

    const simulation = await executeSimulationCommand({
      action: 'create',
      name: 'Integration two-player edge',
      presetKey: 'two_player_edge',
      seed: 424_242,
    }, principal);
    if (!simulation || !('id' in simulation)) throw new Error('Simulation was not created.');
    const simulationId = String(simulation.id);

    await executeSimulationCommand({ action: 'run', simulationId }, principal);
    await executeSimulationCommand({ action: 'advance', simulationId, seconds: 15 * 86_400 }, principal);
    const locked = await getGameMasterData(simulationId);
    expect(locked.selected?.markets.every((market) => market.status === 'locked')).toBe(true);
    expect(locked.selected?.forecasts.length).toBeGreaterThanOrEqual(6);
    expect(locked.selected?.snapshots.length).toBeGreaterThan(0);

    for (const market of locked.selected?.markets ?? []) {
      const game = locked.selected?.games.find((candidate) => candidate.id === market.game_id);
      const actualValue = Number(game?.scenario_values[market.metric_type]);
      await executeSimulationCommand({ action: 'resolve', simulationId, marketId: market.id, actualValue }, principal);
    }
    const resolved = await getGameMasterData(simulationId);
    expect(resolved.selected?.leaderboard).toHaveLength(2);
    expect(resolved.selected?.scoreInspector.length).toBeGreaterThan(0);
    expect(resolved.selected?.markets.every((market) => market.status === 'resolved')).toBe(true);

    const firstMarket = resolved.selected?.markets[0];
    const firstGame = resolved.selected?.games.find((game) => game.id === firstMarket?.game_id);
    if (!firstMarket || !firstGame) throw new Error('Resolved fixture market not found.');
    const correctedValue = Number(firstGame.scenario_values[firstMarket.metric_type]) * 1.05;
    await executeSimulationCommand({ action: 'correct', simulationId, marketId: firstMarket.id, actualValue: correctedValue, note: 'Integration correction' }, principal);
    const corrected = await getGameMasterData(simulationId);
    expect(corrected.selected?.results.find((result) => result.market_id === firstMarket.id)?.result_version).toBe(2);
    expect(corrected.selected?.events.some((event) => event.event_type === 'market_corrected')).toBe(true);
    expect(corrected.selected?.formulaComparison).toHaveLength(3);

    const clone = await executeSimulationCommand({ action: 'clone', simulationId }, principal);
    if (!clone || !('id' in clone)) throw new Error('Simulation was not cloned.');
    const cloned = await getGameMasterData(String(clone.id));
    expect(cloned.selected?.games.length).toBe(corrected.selected?.games.length);
    expect(cloned.selected?.markets.every((market) => market.status === 'resolved')).toBe(true);
    expect(cloned.selected?.results.length).toBe(corrected.selected?.results.length);
    expect(cloned.selected?.leaderboard.map((row) => row.points)).toEqual(corrected.selected?.leaderboard.map((row) => row.points));

    const exported = JSON.parse(await downloadSimulation(simulationId, 'json')) as unknown;
    const importedResult = await executeSimulationCommand({ action: 'import', payload: exported }, principal);
    if (!importedResult || !('id' in importedResult)) throw new Error('Simulation was not imported.');
    const imported = await getGameMasterData(String(importedResult.id));
    expect(imported.selected?.games.length).toBe(corrected.selected?.games.length);
    expect(imported.selected?.players.length).toBe(corrected.selected?.players.length);
    expect(imported.selected?.events.some((event) => event.event_type === 'simulation_imported')).toBe(true);

    const manual = await executeSimulationCommand({
      action: 'create_game', simulationId,
      name: 'Manual Integration Game',
      scenarioValues: { first_weekend_ccu: 12_345, first_month_reviews: 2_345, full_price_us: 19.99 },
      createMarkets: true,
    }, principal);
    if (!manual || !('game' in manual)) throw new Error('Manual game was not created.');
    const afterManual = await getGameMasterData(simulationId);
    const manualGame = afterManual.selected?.games.find((game) => game.name === 'Manual Integration Game');
    const manualMarket = afterManual.selected?.markets.find((market) => market.game_id === manualGame?.id);
    const player = afterManual.selected?.players[0];
    if (!manualMarket || !player) throw new Error('Manual market fixture not found.');
    await executeSimulationCommand({ action: 'submit_forecast', simulationId, marketId: manualMarket.id, playerId: player.id, rawValue: 11_111 }, principal);
    await executeSimulationCommand({ action: 'signal', simulationId, label: 'Streamer coverage', value: 3 }, principal);
    await executeSimulationCommand({ action: 'lock', simulationId, marketId: manualMarket.id }, principal);
    const afterControls = await getGameMasterData(simulationId);
    expect(afterControls.selected?.forecasts.some((forecast) => forecast.market_id === manualMarket.id && forecast.player_id === player.id)).toBe(true);
    expect(afterControls.selected?.markets.find((market) => market.id === manualMarket.id)?.status).toBe('locked');
    expect(afterControls.selected?.events.some((event) => event.event_type === 'external_signal')).toBe(true);

    const designerEmail = `designer-${Date.now()}@test.local`;
    const designer = await admin.auth.admin.createUser({ email: designerEmail, password: 'Designer-password-123!', email_confirm: true });
    if (designer.error || !designer.data.user) throw designer.error ?? new Error('Could not create designer fixture.');
    const granted = await grantGameDesigner(designerEmail, principal);
    expect(granted.kind).toBe('active');
    expect((await getRoleAdminData(designerEmail)).users[0]?.role).toBe('game_designer');
    await revokeGameDesigner(designer.data.user.id, principal);
    expect((await getRoleAdminData(designerEmail)).users[0]?.role).toBe('user');

    const pendingEmail = `pending-${Date.now()}@test.local`;
    const pending = await grantGameDesigner(pendingEmail, principal);
    if (pending.kind !== 'pending') throw new Error('Pending role assignment was not created.');
    expect((await getRoleAdminData(pendingEmail)).pending.some((row) => row.id === pending.id && row.status === 'pending')).toBe(true);
    await revokePendingAssignment(pending.id, principal);
    expect((await getRoleAdminData(pendingEmail)).pending.some((row) => row.id === pending.id && row.status === 'revoked')).toBe(true);

    const claimEmail = `claim-${Date.now()}@test.local`;
    const claimPending = await grantGameDesigner(claimEmail, principal);
    if (claimPending.kind !== 'pending') throw new Error('Claim fixture assignment was not created.');
    const claimedUser = await admin.auth.admin.createUser({ email: claimEmail, password: 'Claim-password-123!', email_confirm: true });
    if (claimedUser.error || !claimedUser.data.user) throw claimedUser.error ?? new Error('Could not create pending-claim user.');
    const claimedData = await getRoleAdminData(claimEmail);
    expect(claimedData.users[0]?.role).toBe('game_designer');
    expect(claimedData.pending.some((row) => row.id === claimPending.id && row.status === 'claimed')).toBe(true);
  }, 120_000);

  it('runs a blank isolated simulation through designer-controlled lifecycle operations', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) throw new Error('Staging integration environment is missing.');
    const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const email = `blank-${Date.now()}@test.local`;
    const created = await admin.auth.admin.createUser({ email, password: 'Blank-password-123!', email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('Could not create blank-flow user.');
    const principal = { userId: created.data.user.id, email, role: 'root' as const, isRoot: true };

    const blankResult = await executeSimulationCommand({ action: 'create_blank', name: 'Blank lifecycle', description: 'Integration blank', startAt: '2026-08-01T00:00:00.000Z', seed: 77 }, principal);
    if (!blankResult || !('id' in blankResult)) throw new Error('Blank simulation was not created.');
    const simulationId = String(blankResult.id);
    expect((await getGameMasterData(simulationId)).selected?.games).toHaveLength(0);
    await executeSimulationCommand({ action: 'create_game', simulationId, name: 'Blank Test Game', releaseAt: '2026-08-08T00:00:00.000Z', scenarioValues: { first_weekend_ccu: 5_200, first_month_reviews: 800, full_price_us: 24.99 }, createMarkets: true }, principal);
    await executeSimulationCommand({ action: 'generate_players', simulationId, count: 4, prefix: 'QA', behavior: 'expert', skillMin: 0.8, skillMax: 0.9, seed: 123 }, principal);
    const ready = await getGameMasterData(simulationId);
    const market = ready.selected?.markets[0];
    if (!market) throw new Error('Blank flow market was not created.');
    await executeSimulationCommand({ action: 'generate_forecasts', simulationId, marketId: market.id, density: 1, distribution: 'fixed', center: 5_000, timing: 'opening' }, principal);
    await executeSimulationCommand({ action: 'advance', simulationId, seconds: 86_400 }, principal);
    await executeSimulationCommand({ action: 'snapshot', simulationId }, principal);
    await executeSimulationCommand({ action: 'lock', simulationId, marketId: market.id }, principal);
    await executeSimulationCommand({ action: 'resolve', simulationId, marketId: market.id, actualValue: 5_200 }, principal);
    const resolved = await getGameMasterData(simulationId);
    expect(resolved.selected?.leaderboard).toHaveLength(4);
    expect(resolved.selected?.snapshotStats.length).toBeGreaterThan(0);
    expect(resolved.selected?.marketStats[market.id]?.scoringStatus).toBe('scored');

    await executeSimulationCommand({ action: 'checkpoint', simulationId }, principal);
    const checkpointed = await getGameMasterData(simulationId);
    const checkpoint = checkpointed.selected?.checkpoints[0];
    if (!checkpoint) throw new Error('Checkpoint was not created.');
    await executeSimulationCommand({ action: 'create_game', simulationId, name: 'Disposable game', scenarioValues: { first_weekend_ccu: 1, first_month_reviews: 1, full_price_us: 1 }, createMarkets: false }, principal);
    await executeSimulationCommand({ action: 'reset', simulationId, checkpointId: checkpoint.id }, principal);
    const restored = await getGameMasterData(simulationId);
    expect(restored.selected?.games.some((game) => game.name === 'Disposable game')).toBe(false);
    expect(restored.selected?.leaderboard).toHaveLength(4);
    const checkpointClone = await executeSimulationCommand({ action: 'clone_checkpoint', simulationId, checkpointId: checkpoint.id }, principal);
    if (!checkpointClone || !('id' in checkpointClone)) throw new Error('Checkpoint clone was not created.');
    expect((await getGameMasterData(String(checkpointClone.id))).selected?.leaderboard).toHaveLength(4);
    expect(await downloadSimulation(simulationId, 'forecasts_csv')).toContain('raw_value');
    expect(await downloadSimulation(simulationId, 'snapshots_csv')).toContain('snapshot_at');
    expect(await downloadSimulation(simulationId, 'scores_csv')).toContain('crowd_without_user_percentile');

    const otherResult = await executeSimulationCommand({ action: 'create_blank', name: 'Isolation control', startAt: '2026-08-01T00:00:00.000Z', seed: 88 }, principal);
    if (!otherResult || !('id' in otherResult)) throw new Error('Isolation simulation was not created.');
    const otherId = String(otherResult.id);
    await executeSimulationCommand({ action: 'reset', simulationId }, principal);
    expect((await getGameMasterData(simulationId)).selected?.games).toHaveLength(0);
    expect((await getGameMasterData(otherId)).selected?.simulation.id).toBe(otherId);
  }, 120_000);
});
