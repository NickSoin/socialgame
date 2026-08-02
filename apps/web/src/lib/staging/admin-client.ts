import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function createStagingAdminClient() {
  const url = process.env.STAGING_SUPABASE_URL;
  const secret = process.env.STAGING_SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error('Staging Supabase server credentials are not configured.');

  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createUniversalAuthAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Universal Supabase Auth server credentials are not configured.');

  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
