import { describe, expect, test } from "vitest";

import { isProtectedRoute } from "./protected-routes";

describe("isProtectedRoute", () => {
  test.each([
    "/dashboard",
    "/dashboard/new",
    "/settings",
    "/settings/security",
    "/admin",
    "/admin/markets/pending",
  ])("protects %s", (pathname) => {
    expect(isProtectedRoute(pathname)).toBe(true);
  });

  test.each(["/", "/login", "/sign-up", "/forgot-password", "/profile", "/profile/test-user", "/profiles", "/administrator"])(
    "does not protect %s",
    (pathname) => {
      expect(isProtectedRoute(pathname)).toBe(false);
    },
  );
});
