import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';

const isProductionBuild = process.env.NODE_ENV === 'production';

if (!isProductionBuild) {
  for (const fileName of ['.env.development.local', '.env.local']) {
    const envPath = path.resolve(import.meta.dirname, `../../${fileName}`);
    if (existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

if (isProductionBuild) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      'Production builds require NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  const supabaseHost = new URL(supabaseUrl).hostname;
  const allowLocalStagingBuild = process.env.APP_ENV === 'staging'
    && process.env.ALLOW_LOCAL_STAGING_BUILD === 'true';
  if (['127.0.0.1', 'localhost', '::1'].includes(supabaseHost) && !allowLocalStagingBuild) {
    throw new Error('Production builds cannot use a local Supabase URL.');
  }

  if (process.env.APP_ENV === 'staging') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const universalAuthSecret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    const stagingSupabaseUrl = process.env.STAGING_SUPABASE_URL;
    const stagingSupabaseSecret = process.env.STAGING_SUPABASE_SECRET_KEY;
    const rootAdmins = process.env.ROOT_ADMIN_EMAILS;
    if (!siteUrl || !universalAuthSecret || !stagingSupabaseUrl || !stagingSupabaseSecret || !rootAdmins) {
      throw new Error('Staging builds require universal Auth and isolated staging database credentials.');
    }
    const siteHost = new URL(siteUrl).hostname;
    const stagingSupabaseHost = new URL(stagingSupabaseUrl).hostname;
    if (['nexthitmarket.com', 'www.nexthitmarket.com'].includes(siteHost)) {
      throw new Error('Staging builds cannot use a production NextHit hostname.');
    }
    if (!allowLocalStagingBuild && supabaseHost !== 'azysnjlxrrvnkzntslqz.supabase.co') {
      throw new Error('Staging builds must use the shared production Supabase Auth project.');
    }
    if (!allowLocalStagingBuild && stagingSupabaseHost === supabaseHost) {
      throw new Error('Staging data must remain isolated from the universal Auth project.');
    }
    if (!allowLocalStagingBuild && ['127.0.0.1', 'localhost', '::1'].includes(stagingSupabaseHost)) {
      throw new Error('Remote staging builds cannot use a local staging database.');
    }
    if (process.env.ENABLE_GAME_MASTER_CONSOLE !== 'true' || process.env.ENABLE_STAGING_ROLE_ADMIN !== 'true') {
      throw new Error('Both staging console feature flags must be enabled in the staging deployment.');
    }
  } else if (
    process.env.ENABLE_GAME_MASTER_CONSOLE === 'true'
    || process.env.ENABLE_STAGING_ROLE_ADMIN === 'true'
  ) {
    throw new Error('Internal staging consoles cannot be enabled outside APP_ENV=staging.');
  }
}

const config: NextConfig = {
  cacheComponents: true,
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default config;
