import 'server-only';
import { headers } from 'next/headers';
import { createSupabaseClient } from '@/supabase-clients/server';
import { createStagingAdminClient } from './admin-client';
import type { StagingPrincipal } from './types';

type StagingFeature = 'game-master' | 'role-admin';

const PRODUCTION_HOSTS = new Set(['nexthitmarket.com', 'www.nexthitmarket.com']);

export class StagingAccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404,
  ) {
    super(message);
  }
}

function hostWithoutPort(host: string | null) {
  return (host ?? '').split(':')[0].toLowerCase();
}

function configuredHosts() {
  return new Set(
    (process.env.STAGING_ALLOWED_HOSTS ?? 'staging.nexthitmarket.com,admin.staging.nexthitmarket.com')
      .split(',')
      .map((host) => hostWithoutPort(host.trim()))
      .filter(Boolean),
  );
}

function isFeatureEnabled(feature: StagingFeature) {
  const flag = feature === 'role-admin'
    ? process.env.ENABLE_STAGING_ROLE_ADMIN
    : process.env.ENABLE_GAME_MASTER_CONSOLE;
  return flag === 'true';
}

export function isAllowedStagingHost(hostHeader: string | null, feature: StagingFeature) {
  const host = hostWithoutPort(hostHeader);
  if (!isFeatureEnabled(feature) || process.env.APP_ENV !== 'staging') return false;
  if (!host || PRODUCTION_HOSTS.has(host)) return false;
  if (host === 'localhost' || host === '127.0.0.1') {
    return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_STAGING_BUILD === 'true';
  }
  return configuredHosts().has(host);
}

function rootEmails() {
  return new Set(
    (process.env.ROOT_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function syncUniversalUserRole(userId: string, email: string) {
  const admin = createStagingAdminClient();
  const seed = await admin.from('staging_user_roles').upsert({
    user_id: userId,
    role: 'user',
  }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (seed.error) throw new Error(seed.error.message);

  const [roleResult, pendingResult] = await Promise.all([
    admin.from('staging_user_roles').select('role').eq('user_id', userId).single(),
    admin
      .from('staging_pending_role_assignments')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (roleResult.error) throw new Error(roleResult.error.message);
  if (pendingResult.error) throw new Error(pendingResult.error.message);

  const pending = pendingResult.data;
  if (!pending) return roleResult.data.role;

  const claimedAt = new Date().toISOString();
  const saveRole = await admin.from('staging_user_roles').upsert({
    user_id: userId,
    role: pending.role,
    granted_by: pending.requested_by,
    granted_at: claimedAt,
  }, { onConflict: 'user_id' });
  if (saveRole.error) throw new Error(saveRole.error.message);

  const claim = await admin
    .from('staging_pending_role_assignments')
    .update({ status: 'claimed', claimed_by: userId, claimed_at: claimedAt })
    .eq('id', pending.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claim.error) throw new Error(claim.error.message);

  if (claim.data) {
    const audit = await admin.from('staging_role_audit_log').insert({
      actor_user_id: pending.requested_by,
      action: 'assignment_claimed',
      target_user_id: userId,
      target_email: email,
      previous_role: roleResult.data.role,
      new_role: pending.role,
      metadata: { assignment_id: pending.id, source: 'universal_auth_login' },
    });
    if (audit.error) throw new Error(audit.error.message);
  }

  return pending.role;
}

export function isRootAdminEmail(email: string | null | undefined) {
  return Boolean(email && rootEmails().has(email.trim().toLowerCase()));
}

async function writeDeniedAudit(email: string | null, feature: StagingFeature, reason: string) {
  try {
    const admin = createStagingAdminClient();
    await admin.from('staging_role_audit_log').insert({
      actor_email: email,
      action: 'access_denied',
      metadata: { feature, reason },
    });
  } catch (error) {
    console.error('Could not write staging access denial audit.', error);
  }
}

export async function requireStagingPrincipal(
  hostHeader: string | null,
  feature: StagingFeature,
): Promise<StagingPrincipal> {
  if (!isAllowedStagingHost(hostHeader, feature)) {
    throw new StagingAccessError('Staging feature is unavailable.', 404);
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) {
    await writeDeniedAudit(null, feature, 'authentication_required');
    throw new StagingAccessError('Authentication required.', 401);
  }

  const email = user.email?.trim().toLowerCase() ?? '';
  if (!email || !user.email_confirmed_at) {
    await writeDeniedAudit(email || null, feature, 'verified_email_required');
    throw new StagingAccessError('A verified email is required.', 403);
  }

  const isRoot = rootEmails().has(email);
  const storedRole = await syncUniversalUserRole(user.id, email);

  const role = isRoot ? 'root' : storedRole === 'game_designer' ? 'game_designer' : 'user';
  const allowed = feature === 'role-admin' ? isRoot : isRoot || role === 'game_designer';
  if (!allowed) {
    await writeDeniedAudit(email, feature, `role_${role}`);
    throw new StagingAccessError('You do not have access to this staging tool.', 403);
  }

  return { userId: user.id, email, role, isRoot };
}

export async function requireStagingPagePrincipal(feature: StagingFeature) {
  const requestHeaders = await headers();
  return requireStagingPrincipal(
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
    feature,
  );
}

export async function requireStagingApiPrincipal(request: Request, feature: StagingFeature) {
  return requireStagingPrincipal(request.headers.get('x-forwarded-host') ?? request.headers.get('host'), feature);
}
