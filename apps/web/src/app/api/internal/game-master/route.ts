import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStagingApiPrincipal, StagingAccessError } from '@/lib/staging/access';
import { downloadSimulation, executeSimulationCommand, getGameMasterData } from '@/lib/staging/simulation-service';

const simulationId = z.string().uuid();
const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().trim().min(1).max(100), presetKey: z.string().min(1).max(80), seed: z.number().int().positive().optional() }),
  z.object({ action: z.literal('create_blank'), name: z.string().trim().min(1).max(100), description: z.string().trim().max(1000).optional(), startAt: z.string().datetime().optional(), seed: z.number().int().positive().optional() }),
  z.object({ action: z.enum(['run', 'pause', 'archive', 'checkpoint', 'clone']), simulationId }),
  z.object({ action: z.literal('reset'), simulationId, checkpointId: z.string().uuid().optional() }),
  z.object({ action: z.literal('clone_checkpoint'), simulationId, checkpointId: z.string().uuid() }),
  z.object({ action: z.literal('advance'), simulationId, seconds: z.number().int().positive().max(31_536_000) }),
  z.object({ action: z.literal('next_event'), simulationId }),
  z.object({ action: z.literal('generate_players'), simulationId, count: z.number().int().min(1).max(500), prefix: z.string().trim().min(1).max(24).optional(), behavior: z.enum(['follower', 'contrarian', 'expert', 'late', 'random', 'outlier']).optional(), skillMin: z.number().min(0).max(1).optional(), skillMax: z.number().min(0).max(1).optional(), seed: z.number().int().positive().optional(), avatarMode: z.string().trim().max(40).optional() }),
  z.object({ action: z.literal('generate_forecasts'), simulationId, density: z.number().min(0.01).max(1).optional(), marketId: z.string().uuid().optional(), distribution: z.enum(['around_actual', 'around_consensus', 'fixed', 'uniform', 'normal', 'log_normal']).optional(), center: z.number().finite().min(0).max(100_000_000).optional(), spread: z.number().finite().min(0).max(100_000_000).optional(), minimum: z.number().finite().min(0).max(100_000_000).optional(), maximum: z.number().finite().min(0).max(100_000_000).optional(), timing: z.enum(['opening', 'uniform', 'early', 'late', 'specific', 'event']).optional(), scheduledAt: z.string().datetime().optional() }),
  z.object({ action: z.literal('snapshot'), simulationId, at: z.string().datetime().optional() }),
  z.object({ action: z.literal('snapshot_batch'), simulationId, until: z.string().datetime() }),
  z.object({ action: z.literal('delete_latest_snapshot'), simulationId, marketId: z.string().uuid().optional() }),
  z.object({ action: z.literal('rebuild_snapshots'), simulationId }),
  z.object({
    action: z.literal('create_game'), simulationId,
    name: z.string().trim().min(1).max(160),
    releaseAt: z.string().datetime().optional(),
    scenarioValues: z.object({
      first_weekend_ccu: z.number().finite().min(0).max(100_000_000),
      first_month_reviews: z.number().finite().min(0).max(100_000_000),
      full_price_us: z.number().finite().min(0).max(100_000_000),
    }),
    createMarkets: z.boolean().optional(),
  }),
  z.object({ action: z.literal('clone_catalog_game'), simulationId, steamAppId: z.number().int().positive(), scenarioValues: z.object({ first_weekend_ccu: z.number().finite().min(0).max(100_000_000), first_month_reviews: z.number().finite().min(0).max(100_000_000), full_price_us: z.number().finite().min(0).max(100_000_000) }) }),
  z.object({ action: z.literal('update_game'), simulationId, gameId: z.string().uuid(), name: z.string().trim().min(1).max(160).optional(), releaseAt: z.string().datetime().optional() }),
  z.object({ action: z.literal('create_market'), simulationId, gameId: z.string().uuid(), metricType: z.enum(['first_weekend_ccu', 'first_month_reviews', 'full_price_us']), lockAt: z.string().datetime().optional(), resolveAfter: z.string().datetime().optional() }),
  z.object({ action: z.literal('submit_forecast'), simulationId, marketId: z.string().uuid(), playerId: z.string().uuid(), rawValue: z.number().finite().min(0).max(100_000_000), at: z.string().datetime().optional() }),
  z.object({ action: z.literal('delete_forecast'), simulationId, forecastId: z.string().uuid() }),
  z.object({ action: z.enum(['reset_player', 'disable_player']), simulationId, playerId: z.string().uuid() }),
  z.object({ action: z.enum(['lock', 'unlock', 'open_market', 'reset_market', 'delete_market', 'reset_scores']), simulationId, marketId: z.string().uuid() }),
  z.object({ action: z.literal('signal'), simulationId, label: z.string().trim().min(1).max(160), description: z.string().trim().max(1000).optional(), marketId: z.string().uuid().optional(), targetValue: z.number().finite().min(0).max(100_000_000).optional(), value: z.number().finite().optional(), strength: z.number().min(0).max(1).optional(), affectedBehaviors: z.array(z.enum(['follower', 'contrarian', 'expert', 'late', 'random', 'outlier'])).max(6).optional() }),
  z.object({ action: z.enum(['resolve', 'correct']), simulationId, marketId: z.string().uuid(), actualValue: z.number().finite().min(0).max(100_000_000), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('void'), simulationId, marketId: z.string().uuid(), reason: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal('impersonate'), simulationId, playerId: z.string().uuid() }),
  z.object({ action: z.literal('end_impersonate'), simulationId, playerId: z.string().uuid() }),
  z.object({ action: z.literal('import'), payload: z.unknown() }),
]);

function errorResponse(error: unknown) {
  if (error instanceof StagingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid command.', issues: error.issues }, { status: 400 });
  console.error('Game Master request failed.', error);
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Game Master request failed.' }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    await requireStagingApiPrincipal(request, 'game-master');
    const url = new URL(request.url);
    const selectedId = url.searchParams.get('simulationId');
    const exportFormat = url.searchParams.get('export');
    if (exportFormat === 'json' || exportFormat === 'csv' || exportFormat === 'forecasts_csv' || exportFormat === 'snapshots_csv' || exportFormat === 'scores_csv') {
      const id = simulationId.parse(selectedId);
      const body = await downloadSimulation(id, exportFormat);
      const extension = exportFormat === 'json' ? 'json' : 'csv';
      return new Response(body, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="next-hit-simulation-${id}-${exportFormat}.${extension}"`,
          'Content-Type': exportFormat === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
    const data = await getGameMasterData(selectedId);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireStagingApiPrincipal(request, 'game-master');
    const command = commandSchema.parse(await request.json());
    const result = await executeSimulationCommand(command, principal);
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch (error) {
    return errorResponse(error);
  }
}
