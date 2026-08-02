import { afterEach, describe, expect, test } from 'vitest';
import { getAuthCookieOptions } from './cookie-options';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('getAuthCookieOptions', () => {
  test.each([
    'https://nexthitmarket.com',
    'https://www.nexthitmarket.com',
    'https://staging.nexthitmarket.com',
    'https://admin.staging.nexthitmarket.com',
  ])('shares the auth session across NextHit hosts for %s', (siteUrl) => {
    process.env.NEXT_PUBLIC_SITE_URL = siteUrl;

    expect(getAuthCookieOptions()).toEqual({
      domain: '.nexthitmarket.com',
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  });

  test('keeps local development cookies host-only', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

    expect(getAuthCookieOptions()).toEqual({ path: '/', sameSite: 'lax' });
  });
});
