import { NextResponse, type NextRequest } from 'next/server';
import { match } from 'path-to-regexp';
import { updateSession } from './supabase-clients/middleware';

const apiRoutes = ['/api{/*path}'];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(':')[0]
    .toLowerCase();

  if (host === 'admin.staging.nexthitmarket.com' && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/internal/staging-admin';
    return NextResponse.redirect(url);
  }

  // API routes bypass the proxy for this project.
  if (apiRoutes.some((route) => match(route)(pathname))) {
    return null;
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets and the Next.js image pipeline.
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
