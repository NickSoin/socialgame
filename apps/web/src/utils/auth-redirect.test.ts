import { describe, expect, test } from "vitest";

import { DEFAULT_AUTH_REDIRECT, sanitizeAuthRedirect } from "./auth-redirect";

describe("sanitizeAuthRedirect", () => {
  test.each([
    null,
    undefined,
    "",
    "dashboard",
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "///attacker.example/steal",
    "/\\attacker.example/steal",
    "/%2f%2fattacker.example/steal",
    "/%5cattacker.example/steal",
    "/\t/attacker.example/steal",
  ])("rejects unsafe redirect %j", (redirect) => {
    expect(sanitizeAuthRedirect(redirect)).toBe(DEFAULT_AUTH_REDIRECT);
  });

  test.each([
    ["/dashboard", "/dashboard"],
    ["/profile/test-user", "/profile/test-user"],
    ["/settings?tab=security", "/settings?tab=security"],
    ["/admin/markets#pending", "/admin/markets#pending"],
  ])("keeps safe same-origin path %s", (redirect, expected) => {
    expect(sanitizeAuthRedirect(redirect)).toBe(expected);
  });

  test("uses a caller-provided fallback", () => {
    expect(sanitizeAuthRedirect("//attacker.example", "/login")).toBe("/login");
  });
});
