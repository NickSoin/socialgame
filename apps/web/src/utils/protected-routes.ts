import { match } from "path-to-regexp";

export const PROTECTED_ROUTE_PATTERNS = [
  "/dashboard{/*path}",
  "/settings{/*path}",
  "/admin{/*path}",
  "/private-item{/*path}",
  "/private-items{/*path}",
  "/items{/*path}",
  "/item{/*path}",
] as const;

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PATTERNS.some((pattern) => match(pattern)(pathname));
}
