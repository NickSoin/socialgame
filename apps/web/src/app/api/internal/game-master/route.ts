import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStagingApiPrincipal, StagingAccessError } from '@/lib/staging/access';
import {
  executeStagingWorkspaceCommand,
  getStagingWorkspaceData,
} from '@/lib/staging/market-workspace-service';

const simulationId = z.string().uuid();
const playerId = z.string().uuid();
const steamAppId = z.number().int().positive();
const metricType = z.enum(['first_weekend_ccu', 'first_month_reviews', 'full_price_us']);
const forecastValue = z.number().finite().min(0).max(100_000_000);

const commandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add_player'),
    simulationId,
    displayName: z.string().trim().min(1).max(80),
  }),
  z.object({ action: z.literal('delete_player'), simulationId, playerId }),
  z.object({
    action: z.literal('place_forecast'),
    simulationId,
    steamAppId,
    playerId,
    metricType,
    rawValue: forecastValue,
  }),
  z.object({
    action: z.literal('batch_forecasts'),
    simulationId,
    steamAppId,
    metricType,
    count: z.number().int().min(1).max(2_000),
    minimum: forecastValue,
    maximum: forecastValue,
  }),
  z.object({ action: z.literal('resolve_game'), simulationId, steamAppId }),
]);

function errorResponse(error: unknown) {
  if (error instanceof StagingAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'Invalid staging command.', issues: error.issues }, { status: 400 });
  }
  console.error('Staging workspace request failed.', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Staging workspace request failed.' },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const principal = await requireStagingApiPrincipal(request, 'game-master');
    const data = await getStagingWorkspaceData(principal);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireStagingApiPrincipal(request, 'game-master');
    const command = commandSchema.parse(await request.json());
    const result = await executeStagingWorkspaceCommand(command, principal);
    return NextResponse.json({ ok: true, result }, {
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
