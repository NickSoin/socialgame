import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

import { GET } from "./route";

describe("auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  test("redirects a successful exchange to a safe internal path", async () => {
    const response = await GET(
      new Request("https://steam.test/auth/callback?code=valid&next=%2Fsettings%2Fsecurity"),
    );

    expect(response.headers.get("location")).toBe("https://steam.test/settings/security");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("does not redirect to an external next URL", async () => {
    const response = await GET(
      new Request(
        "https://steam.test/auth/callback?code=valid&next=https%3A%2F%2Fattacker.example",
      ),
    );

    expect(response.headers.get("location")).toBe("https://steam.test/");
  });

  test("redirects to the auth error page when code exchange returns an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: "expired code" },
    });

    const response = await GET(new Request("https://steam.test/auth/callback?code=expired"));

    expect(response.headers.get("location")).toBe("https://steam.test/auth/auth-code-error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test("keeps the no-code reset completion path internal", async () => {
    const response = await GET(
      new Request("https://steam.test/auth/callback?next=%2F%2Fattacker.example"),
    );

    expect(response.headers.get("location")).toBe("https://steam.test/");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
