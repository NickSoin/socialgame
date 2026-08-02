const SHARED_AUTH_COOKIE_DOMAIN = '.nexthitmarket.com';

export function getAuthCookieOptions() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return { path: '/', sameSite: 'lax' as const };

  try {
    const hostname = new URL(siteUrl).hostname.toLowerCase();
    const usesSharedDomain = hostname === 'nexthitmarket.com'
      || hostname.endsWith('.nexthitmarket.com');

    return usesSharedDomain
      ? {
          domain: SHARED_AUTH_COOKIE_DOMAIN,
          path: '/',
          sameSite: 'lax' as const,
          secure: true,
        }
      : { path: '/', sameSite: 'lax' as const };
  } catch {
    return { path: '/', sameSite: 'lax' as const };
  }
}
