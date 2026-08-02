import { describe, expect, test } from "vitest";

import { isProtectedRoute } from "./protected-routes";

describe("isProtectedRoute", () => {
  test.each([
    "/",
    "/trending",
    "/completed",
    "/profile",
    "/profile/test-user",
    "/profiles",
    "/dashboard",
    "/dashboard/new",
    "/settings",
    "/settings/security",
    "/admin",
    "/admin/markets/pending",
  ])("protects %s", (pathname) => {
    expect(isProtectedRoute(pathname)).toBe(true);
  });

  test.each([
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
  ])(
    "does not protect %s",
    (pathname) => {
      expect(isProtectedRoute(pathname)).toBe(false);
    },
  );
});
