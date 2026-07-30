import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      verifyOtp: mocks.verifyOtp,
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

import { GET } from "./route";

describe("auth confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({ error: null });
  });

  test("redirects a verified token to a safe internal path", async () => {
    const response = await GET(
      new NextRequest(
        "https://steam.test/auth/confirm?token_hash=valid&next=%2Fprofile%2Ftest-user",
      ),
    );

    expect(response.headers.get("location")).toBe("https://steam.test/profile/test-user");
  });

  test("does not redirect a verified token to an external URL", async () => {
    const response = await GET(
      new NextRequest(
        "https://steam.test/auth/confirm?token_hash=valid&next=%2F%2Fattacker.example",
      ),
    );

    expect(response.headers.get("location")).toBe("https://steam.test/");
  });

  test("redirects a failed verification to the auth error page", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "invalid token" } });

    const response = await GET(
      new NextRequest("https://steam.test/auth/confirm?token_hash=invalid"),
    );

    expect(response.headers.get("location")).toBe("https://steam.test/auth/auth-code-error");
  });
});
