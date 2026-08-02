'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getAuthCookieOptions } from './cookie-options';

export function createClient(): ReturnType<typeof createBrowserClient> {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: getAuthCookieOptions() },
  );
}
