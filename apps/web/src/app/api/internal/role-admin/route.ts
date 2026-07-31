import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStagingApiPrincipal, StagingAccessError } from '@/lib/staging/access';
import {
  getRoleAdminData,
  grantGameDesigner,
  revokeGameDesigner,
  revokePendingAssignment,
} from '@/lib/staging/role-admin-service';

const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), email: z.string().email().max(320) }),
  z.object({ action: z.literal('revoke'), userId: z.string().uuid() }),
  z.object({ action: z.literal('revoke_pending'), assignmentId: z.string().uuid() }),
]);

function errorResponse(error: unknown) {
  if (error instanceof StagingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid role command.', issues: error.issues }, { status: 400 });
  console.error('Role Admin request failed.', error);
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Role Admin request failed.' }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    await requireStagingApiPrincipal(request, 'role-admin');
    const data = await getRoleAdminData(new URL(request.url).searchParams.get('q') ?? '');
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireStagingApiPrincipal(request, 'role-admin');
    const command = commandSchema.parse(await request.json());
    const result = command.action === 'grant'
      ? await grantGameDesigner(command.email, principal)
      : command.action === 'revoke'
        ? await revokeGameDesigner(command.userId, principal)
        : await revokePendingAssignment(command.assignmentId, principal);
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch (error) {
    return errorResponse(error);
  }
}
