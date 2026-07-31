import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SteamUpcomingGame } from "@/lib/steam-bets";

const mocks = vi.hoisted(() => ({ loadSteamFeedPage: vi.fn() }));

vi.mock("@/data/actions/load-steam-feed-page", () => ({
  loadSteamFeedPage: mocks.loadSteamFeedPage,
}));
vi.mock("./forecast-feed", () => ({
  ForecastFeed: ({ games }: { games: SteamUpcomingGame[] }) => (
    <div>{games.map((game) => <span key={game.appId}>{game.name}</span>)}</div>
  ),
}));

import { InfiniteForecastFeed } from "./infinite-forecast-feed";

const game = (appId: number): SteamUpcomingGame => ({
  appId,
  imageUrl: `/games/${appId}.jpg`,
  lifecycleStatus: "upcoming",
  name: `Game ${appId}`,
  releaseDate: "2026-08-01",
  releaseLabel: "TBA",
  tags: [],
  wishlistRank: appId,
  targets: [],
});

let intersectionCallback: IntersectionObserverCallback;

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "320px 0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
}

beforeEach(() => {
  mocks.loadSteamFeedPage.mockReset();
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

describe("InfiniteForecastFeed", () => {
  it("loads and appends the next page when the sentinel enters the viewport", async () => {
    let resolvePage: (value: { games: SteamUpcomingGame[]; hasMore: boolean }) => void = () => {};
    mocks.loadSteamFeedPage.mockReturnValue(new Promise((resolve) => {
      resolvePage = resolve;
    }));

    render(
      <InfiniteForecastFeed
        games={[game(1)]}
        hasMore
        heading="Upcoming games"
        isAuthenticated={false}
        mode="upcoming"
        query=""
        status="open"
      />,
    );

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getByRole("status").textContent).toContain("Loading more games");
    expect(mocks.loadSteamFeedPage).toHaveBeenCalledWith({
      mode: "upcoming",
      page: 2,
      query: "",
      status: "open",
    });

    await act(async () => resolvePage({ games: [game(2)], hasMore: false }));

    await waitFor(() => expect(screen.queryByText("Game 2")).not.toBeNull());
    expect(screen.queryByText(/Page \d/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });
});
