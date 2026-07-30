import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderSearch, type HeaderSearchGame } from "./header-search";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  mocks.push.mockReset();
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

const games: HeaderSearchGame[] = [
  {
    appId: 1,
    imageUrl: "https://example.com/corsair.jpg",
    name: "Corsair Cove",
    releaseLabel: "July 31",
    wishlistRank: 77,
  },
  {
    appId: 2,
    imageUrl: "https://example.com/beast.jpg",
    name: "Beast of Reincarnation",
    releaseLabel: "August 3",
    wishlistRank: 40,
  },
];

describe("HeaderSearch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ games: [games[0]] }),
        ok: true,
      }),
    );
  });

  it("searches the catalog as the user types and navigates on selection", async () => {
    render(<HeaderSearch />);

    fireEvent.change(screen.getByRole("combobox", { name: "Search games" }), {
      target: { value: "cors" },
    });

    expect(await screen.findByText("Corsair Cove")).toBeTruthy();
    expect(screen.queryByText("Beast of Reincarnation")).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/games/search?q=cors", expect.any(Object));
    expect(screen.getByLabelText("Top wishlisted rank 77").textContent).toBe("#77");
    expect(document.querySelector(".sb-game-hero.is-search img")?.getAttribute("src")).toBe(
      "/api/steam-artwork/1",
    );

    fireEvent.click(screen.getByText("Corsair Cove"));
    expect(mocks.push).toHaveBeenCalledWith("/?q=Corsair+Cove");
  });

  it("shows an empty state when no games match", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ games: [] }),
      ok: true,
    } as Response);
    render(<HeaderSearch />);
    fireEvent.change(screen.getByRole("combobox", { name: "Search games" }), {
      target: { value: "nothing" },
    });
    await waitFor(() => expect(screen.getByText("No matching games")).toBeTruthy());
  });
});
