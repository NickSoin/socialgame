import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createStagingAdminClient } from './admin-client';
import { isRootAdminEmail } from './access';
import type { StagingPrincipal } from './types';

function assertNoError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function listAllUsers() {
  const client = createStagingAdminClient();
  const users: User[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1_000 });
    assertNoError(error, 'Could not list staging auth users');
    users.push(...data.users);
    if (data.users.length < 1_000) break;
  }
  return users;
}

export async function getRoleAdminData(query = '') {
  const client = createStagingAdminClient();
  const normalizedQuery = query.trim().toLowerCase();
  const [allUsers, rolesResult, profilesResult, pendingResult, auditResult] = await Promise.all([
    listAllUsers(),
    client.from('staging_user_roles').select('*'),
    client.from('profiles').select('id,username,display_name'),
    client.from('staging_pending_role_assignments').select('*').order('requested_at', { ascending: false }).limit(100),
    client.from('staging_role_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  assertNoError(rolesResult.error, 'Could not load staging roles');
  assertNoError(profilesResult.error, 'Could not load staging profiles');
  assertNoError(pendingResult.error, 'Could not load pending role assignments');
  assertNoError(auditResult.error, 'Could not load role audit log');
  const roleMap = new Map((rolesResult.data ?? []).map((row) => [row.user_id, row.role]));
  const profileMap = new Map((profilesResult.data ?? []).map((row) => [row.id, row]));

  const users = allUsers
    .map((user) => {
      const profile = profileMap.get(user.id);
      const email = user.email?.toLowerCase() ?? '';
      return {
        id: user.id,
        email,
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? null,
        role: isRootAdminEmail(email) ? 'root' : roleMap.get(user.id) ?? 'user',
        verified: Boolean(user.email_confirmed_at),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      };
    })
    .filter((user) => !normalizedQuery || [user.email, user.username, user.displayName]
      .some((value) => value?.toLowerCase().includes(normalizedQuery)))
    .slice(0, 100);

  return {
    users,
    pending: pendingResult.data ?? [],
    audit: auditResult.data ?? [],
    query: normalizedQuery,
  };
}

async function findUserByEmail(email: string) {
  const users = await listAllUsers();
  return users.find((user) => user.email?.trim().toLowerCase() === email) ?? null;
}

async function audit(
  principal: StagingPrincipal,
  action: string,
  target: { id?: string; email?: string },
  previousRole: 'user' | 'game_designer' | null,
  newRole: 'user' | 'game_designer' | null,
  metadata: Record<string, unknown> = {},
) {
  const client = createStagingAdminClient();
  const { error } = await client.from('staging_role_audit_log').insert({
    actor_user_id: principal.userId,
    actor_email: principal.email,
    action,
    target_user_id: target.id ?? null,
    target_email: target.email ?? null,
    previous_role: previousRole,
    new_role: newRole,
    metadata,
  });
  assertNoError(error, 'Could not append role audit');
}

export async function grantGameDesigner(emailInput: string, principal: StagingPrincipal) {
  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
  if (isRootAdminEmail(email)) throw new Error('Root is environment-derived and cannot be assigned or changed.');
  const client = createStagingAdminClient();
  const user = await findUserByEmail(email);

  if (!user) {
    const existing = await client.from('staging_pending_role_assignments').select('id').eq('email', email).eq('status', 'pending').maybeSingle();
    assertNoError(existing.error, 'Could not inspect pending assignment');
    if (existing.data) return { kind: 'pending' as const, id: existing.data.id };
    const pending = await client.from('staging_pending_role_assignments').insert({
      email,
      role: 'game_designer',
      requested_by: principal.userId,
    }).select('id').single();
    assertNoError(pending.error, 'Could not create pending assignment');
    if (!pending.data) throw new Error('Could not read the pending assignment after creation.');
    await audit(principal, 'assignment_created', { email }, null, 'game_designer', { assignment_id: pending.data.id });
    return { kind: 'pending' as const, id: pending.data.id };
  }
  if (!user.email_confirmed_at) throw new Error('The user must verify their email before receiving an active role.');
  const current = await client.from('staging_user_roles').select('role').eq('user_id', user.id).maybeSingle();
  assertNoError(current.error, 'Could not read current role');
  if (current.data?.role === 'game_designer') return { kind: 'active' as const, userId: user.id };
  const save = await client.from('staging_user_roles').upsert({
    user_id: user.id,
    role: 'game_designer',
    granted_by: principal.userId,
    granted_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  assertNoError(save.error, 'Could not grant game designer role');
  await audit(principal, 'role_granted', { id: user.id, email }, current.data?.role ?? 'user', 'game_designer');
  return { kind: 'active' as const, userId: user.id };
}

export async function revokeGameDesigner(userId: string, principal: StagingPrincipal) {
  const client = createStagingAdminClient();
  const { data, error } = await client.auth.admin.getUserById(userId);
  assertNoError(error, 'Could not find staging user');
  const user = data.user;
  if (!user) throw new Error('Staging user not found.');
  const email = user.email?.trim().toLowerCase() ?? '';
  if (isRootAdminEmail(email)) throw new Error('Root is environment-derived and cannot be revoked.');
  const current = await client.from('staging_user_roles').select('role').eq('user_id', userId).maybeSingle();
  assertNoError(current.error, 'Could not read current role');
  const save = await client.from('staging_user_roles').upsert({
    user_id: userId,
    role: 'user',
    granted_by: principal.userId,
    granted_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  assertNoError(save.error, 'Could not revoke game designer role');
  await audit(principal, 'role_revoked', { id: userId, email }, current.data?.role ?? 'user', 'user');
  return { userId, role: 'user' as const };
}

export async function revokePendingAssignment(assignmentId: string, principal: StagingPrincipal) {
  const client = createStagingAdminClient();
  const current = await client.from('staging_pending_role_assignments').select('*').eq('id', assignmentId).eq('status', 'pending').single();
  assertNoError(current.error, 'Pending assignment not found');
  if (isRootAdminEmail(current.data.email)) throw new Error('Root assignments are not supported.');
  const save = await client.from('staging_pending_role_assignments').update({
    status: 'revoked',
    revoked_by: principal.userId,
    revoked_at: new Date().toISOString(),
  }).eq('id', assignmentId).eq('status', 'pending');
  assertNoError(save.error, 'Could not revoke pending assignment');
  await audit(principal, 'assignment_revoked', { email: current.data.email }, null, null, { assignment_id: assignmentId });
  return { assignmentId, status: 'revoked' as const };
}
