import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { devices, type PlaywrightTestConfig } from '@playwright/test';
import path from 'node:path';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(currentDir, '..', 'staging-database');
const port = Number(process.env.STAGING_E2E_PORT ?? 3200);
const baseURL = `http://127.0.0.1:${port}`;
const rootEmail = 'playwright-root@staging.local';

function localStagingEnv() {
  const output = execSync('pnpm exec supabase status -o env', { cwd: databaseDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (match) values[match[1]] = match[2].replace(/"$/, '');
  }
  if (!values.API_URL || !values.PUBLISHABLE_KEY || !values.SECRET_KEY) throw new Error('Start the isolated staging Supabase stack before staging browser tests.');
  return {
    ...process.env,
    APP_ENV: 'staging',
    NEXT_PUBLIC_SITE_URL: baseURL,
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: values.SECRET_KEY,
    STAGING_SUPABASE_URL: values.API_URL,
    STAGING_SUPABASE_SECRET_KEY: values.SECRET_KEY,
    ENABLE_GAME_MASTER_CONSOLE: 'true',
    ENABLE_STAGING_ROLE_ADMIN: 'true',
    ROOT_ADMIN_EMAILS: rootEmail,
    STAGING_ALLOWED_HOSTS: `127.0.0.1:${port},localhost:${port}`,
    ALLOW_LOCAL_STAGING_BUILD: 'true',
    STAGING_E2E_ROOT_EMAIL: rootEmail,
  };
}

const webServerEnv = localStagingEnv();
Object.assign(process.env, webServerEnv);

const config: PlaywrightTestConfig = {
  testDir: path.join(currentDir, 'e2e', 'staging'),
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${port}`,
    cwd: currentDir,
    env: webServerEnv,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
};

export default config;
