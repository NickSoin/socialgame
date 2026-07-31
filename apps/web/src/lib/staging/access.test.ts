import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedStagingHost, isRootAdminEmail } from './access';

const original = {
  APP_ENV: process.env.APP_ENV,
  ENABLE_GAME_MASTER_CONSOLE: process.env.ENABLE_GAME_MASTER_CONSOLE,
  ENABLE_STAGING_ROLE_ADMIN: process.env.ENABLE_STAGING_ROLE_ADMIN,
  STAGING_ALLOWED_HOSTS: process.env.STAGING_ALLOWED_HOSTS,
  ROOT_ADMIN_EMAILS: process.env.ROOT_ADMIN_EMAILS,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('staging environment guards', () => {
  it('never enables internal tools on production hosts', () => {
    process.env.APP_ENV = 'staging';
    process.env.ENABLE_GAME_MASTER_CONSOLE = 'true';
    process.env.ENABLE_STAGING_ROLE_ADMIN = 'true';
    process.env.STAGING_ALLOWED_HOSTS = 'staging.nexthitmarket.com,admin.staging.nexthitmarket.com';
    expect(isAllowedStagingHost('nexthitmarket.com', 'game-master')).toBe(false);
    expect(isAllowedStagingHost('www.nexthitmarket.com', 'role-admin')).toBe(false);
  });

  it('requires staging mode, the feature flag, and an explicit host', () => {
    process.env.APP_ENV = 'staging';
    process.env.ENABLE_GAME_MASTER_CONSOLE = 'true';
    process.env.STAGING_ALLOWED_HOSTS = 'staging.nexthitmarket.com';
    expect(isAllowedStagingHost('staging.nexthitmarket.com', 'game-master')).toBe(true);
    process.env.APP_ENV = 'production';
    expect(isAllowedStagingHost('staging.nexthitmarket.com', 'game-master')).toBe(false);
  });

  it('derives root only from the server-side email list', () => {
    process.env.ROOT_ADMIN_EMAILS = 'Owner@Example.com';
    expect(isRootAdminEmail('owner@example.com')).toBe(true);
    expect(isRootAdminEmail('designer@example.com')).toBe(false);
  });
});
