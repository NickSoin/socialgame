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
  if (['127.0.0.1', 'localhost', '::1'].includes(supabaseHost)) {
    throw new Error('Production builds cannot use a local Supabase URL.');
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
