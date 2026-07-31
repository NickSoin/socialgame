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
  const admin = createStagingAdminClient();
  const { data: storedRole, error: roleError } = await admin
    .from('staging_user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (roleError) throw new Error(roleError.message);

  const role = isRoot ? 'root' : storedRole?.role === 'game_designer' ? 'game_designer' : 'user';
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
