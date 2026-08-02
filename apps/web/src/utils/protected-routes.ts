import { match } from "path-to-regexp";

export const PUBLIC_ROUTE_PATTERNS = [
  "/login",
  "/sign-up",
  "/forgot-password",
  "/update-password",
  "/auth/callback",
  "/auth/confirm",
  "/auth/auth-code-error",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap-0.xml",
] as const;

export function isProtectedRoute(pathname: string): boolean {
  return !PUBLIC_ROUTE_PATTERNS.some((pattern) => match(pattern)(pathname));
}
