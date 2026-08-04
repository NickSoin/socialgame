import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STEAM_BET_TARGETS, type SteamUpcomingGame } from "@/lib/steam-bets";
import { getSteamGameHeroUrl } from "@/lib/steam-game-hero";
import { ForecastCard } from "./forecast-card";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("next-safe-action/hooks", () => ({
  useAction: () => ({ execute: mocks.execute, status: "idle" }),
}));

vi.mock("@/data/actions/gamecast-actions", () => ({
  placeSteamBetAction: {},
}));

const game: SteamUpcomingGame = {
  appId: 42,
  imageUrl: "https://example.com/game.jpg",
  lifecycleStatus: "upcoming",
  name: "Input Limit Test",
  releaseDate: "2026-08-01",
  releaseLabel: "August 1",
  tags: ["Action", "RPG", "Singleplayer"],
  wishlistRank: 77,
  followerCount: 12_345,
  targets: STEAM_BET_TARGETS.map((target) => ({
    ...target,
    averageValue: 200,
    averageHistory: [
      { at: "2026-07-30T00:00:00.000Z", averageValue: 150 },
      { at: "2026-07-31T00:00:00.000Z", averageValue: 200 },
    ],
    predictionCount: 7_000_000,
    userValue: null,
    userPercentile: null,
    marketStatus: "open",
    lockAt: null,
    actualValue: null,
    actualPercentile: null,
    points: 0,
    scoredDays: 0,
  })),
};

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ForecastCard", () => {
  it("shows two primary forecasts and expands the remaining three-column panel", () => {
    const { container } = render(<ForecastCard game={game} isAuthenticated />);

    expect(screen.getAllByText("200")).toHaveLength(2);
    expect(screen.getAllByText("7M forecasts")).toHaveLength(2);
    expect(screen.getAllByText("00:00 01/08/26")).toHaveLength(2);
    expect(screen.getByText("August 1").getAttribute("dateTime")).toBe("2026-08-01");
    expect(screen.getByLabelText("Top wishlisted rank 77").textContent).toContain("#77");
    expect(screen.getByText("Action · RPG · Singleplayer")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open Input Limit Test on Steam" }).getAttribute("href"),
    ).toBe("https://store.steampowered.com/app/42/");
    expect(document.querySelector('img[src*="favicon"]')).toBeNull();

    const expand = screen.getByRole("button", {
      name: "Expand all forecasts for Input Limit Test",
    });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expand);

    expect(screen.getByText("Launch price in US, $")).toBeTruthy();
    expect(screen.getByText("Launch discount")).toBeTruthy();
    expect(screen.getAllByText("7M forecasts")).toHaveLength(4);
    expect(container.querySelectorAll(".sb-game-card__expanded-panel > *")).toHaveLength(3);
    expect(container.querySelectorAll(".sb-forecast-tile-placeholder")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Collapse all forecasts for Input Limit Test" }),
    ).toBeTruthy();
  });

  it("uses a clean empty chart state and singular forecast count", () => {
    const sparse = {
      ...game,
      targets: game.targets.map((target, index) =>
        index === 0
          ? { ...target, averageValue: 332, averageHistory: [], predictionCount: 1 }
          : index === 1
            ? { ...target, averageValue: null, averageHistory: [], predictionCount: 0 }
            : target,
      ),
    };

    render(<ForecastCard game={sparse} isAuthenticated />);

    expect(screen.getByText("1 forecast")).toBeTruthy();
    expect(screen.getByText("0 forecasts")).toBeTruthy();
    expect(screen.queryByText("No average yet")).toBeNull();
    expect(
      screen.getByRole("img", {
        name: "First month total reviews average forecast trend: no data yet",
      }),
    ).toBeTruthy();
  });

  it("cycles hero and two screenshots on every clickable-card hover", () => {
    vi.useFakeTimers();
    const previewGame = {
      ...game,
      appId: 1_368_140,
      name: "Corsair Cove",
      previewUrls: ["/storage/1368140-1.webp", "/storage/1368140-2.webp"],
    };
    const { container } = render(<ForecastCard game={previewGame} isAuthenticated />);
    const card = container.querySelector(".sb-game-card") as HTMLElement;
    const artwork = screen.getByRole("img", { name: "Corsair Cove artwork" });

    fireEvent.mouseEnter(card);
    expect(artwork.getAttribute("src")).toBe(game.imageUrl);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewGame.previewUrls[0]);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewGame.previewUrls[1]);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(game.imageUrl);

    fireEvent.mouseLeave(card);
    expect(artwork.getAttribute("src")).toBe(game.imageUrl);
    fireEvent.mouseEnter(card);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewGame.previewUrls[0]);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewGame.previewUrls[1]);
  });

  it("falls back to the Steam artwork resolver when a stored banner is missing", () => {
    render(<ForecastCard game={game} isAuthenticated />);
    const artwork = screen.getByRole("img", { name: "Input Limit Test artwork" });
    fireEvent.error(artwork);
    expect(artwork.getAttribute("src")).toBe(getSteamGameHeroUrl(42));
  });

  it("replaces a legacy Steam capsule image with the current GameHero artwork", () => {
    render(<ForecastCard game={game} isAuthenticated />);
    const artwork = screen.getByRole("img", { name: "Input Limit Test artwork" });
    Object.defineProperties(artwork, {
      naturalWidth: { configurable: true, value: 231 },
      naturalHeight: { configurable: true, value: 87 },
    });
    fireEvent.load(artwork);
    expect(artwork.getAttribute("src")).toBe(getSteamGameHeroUrl(42));
  });

  it("replaces a legacy image that finished loading before hydration", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(231);
    vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(87);
    render(<ForecastCard game={game} isAuthenticated />);
    expect(screen.getByRole("img", { name: "Input Limit Test artwork" }).getAttribute("src")).toBe(
      getSteamGameHeroUrl(42),
    );
  });

  it("enforces all four target-specific character limits while typing", () => {
    render(<ForecastCard game={game} isAuthenticated />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Forecast First weekend peak CCU for Input Limit Test",
      }),
    );
    let input = screen.getByRole("textbox", {
      name: "First weekend peak CCU for Input Limit Test",
    }) as HTMLInputElement;
    expect(input.maxLength).toBe(7);
    fireEvent.change(input, { target: { value: "123456789" } });
    expect(input.value).toBe("1234567");
    fireEvent.click(screen.getByRole("button", { name: "Cancel First weekend peak CCU forecast" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Forecast First month total reviews for Input Limit Test",
      }),
    );
    input = screen.getByRole("textbox", {
      name: "First month total reviews for Input Limit Test",
    }) as HTMLInputElement;
    expect(input.maxLength).toBe(6);
    fireEvent.change(input, { target: { value: "987654321" } });
    expect(input.value).toBe("987654");
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel First month total reviews forecast" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand all forecasts for Input Limit Test" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Forecast Launch price in US, $ for Input Limit Test",
      }),
    );
    input = screen.getByRole("textbox", {
      name: "Launch price in US, $ for Input Limit Test",
    }) as HTMLInputElement;
    expect(input.maxLength).toBe(7);
    fireEvent.change(input, { target: { value: "123,4567" } });
    expect(input.value).toBe("123.456");
    fireEvent.click(screen.getByRole("button", { name: "Cancel Launch price in US, $ forecast" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Forecast Launch discount for Input Limit Test",
      }),
    );
    input = screen.getByRole("textbox", {
      name: "Launch discount for Input Limit Test",
    }) as HTMLInputElement;
    expect(input.maxLength).toBe(3);
    fireEvent.change(input, { target: { value: "1200" } });
    expect(input.value).toBe("120");
  });

  it("submits the bounded draft instead of a lossy number-input value", () => {
    render(<ForecastCard game={game} isAuthenticated />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Forecast First weekend peak CCU for Input Limit Test",
      }),
    );
    const ccu = screen.getByRole("textbox", {
      name: "First weekend peak CCU for Input Limit Test",
    });
    fireEvent.change(ccu, { target: { value: "12345678" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm First weekend peak CCU forecast" }),
    );

    expect(mocks.execute).toHaveBeenCalledWith({
      steamAppId: 42,
      targetKey: "first_weekend_ccu",
      value: "1234567",
    });
  });

  it("cancels a draft without submitting it", () => {
    render(<ForecastCard game={game} isAuthenticated />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Forecast First weekend peak CCU for Input Limit Test",
      }),
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "First weekend peak CCU for Input Limit Test",
      }),
      { target: { value: "9000" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel First weekend peak CCU forecast" }));

    expect(mocks.execute).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Confirm First weekend peak CCU forecast" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Forecast First weekend peak CCU for Input Limit Test",
      }),
    ).toBeTruthy();
  });

  it("shows a saved forecast in place of the button and lets it be edited", () => {
    const predicted = {
      ...game,
      targets: game.targets.map((target, index) =>
        index === 0 ? { ...target, userValue: 1000, userPercentile: 34 } : target,
      ),
    };
    render(<ForecastCard game={predicted} isAuthenticated />);

    const saved = screen.getByRole("button", {
      name: "Edit First weekend peak CCU forecast for Input Limit Test",
    });
    expect(saved.textContent).toBe("1,000");
    fireEvent.click(saved);
    const input = screen.getByRole("textbox", {
      name: "First weekend peak CCU for Input Limit Test",
    }) as HTMLInputElement;
    expect(input.value).toBe("1000");
    expect(
      screen.getByRole("button", { name: "Confirm First weekend peak CCU forecast" }),
    ).toBeTruthy();
  });

  it("shows Locked for both locked and resolved markets", () => {
    const closed = {
      ...game,
      targets: game.targets.map((target, index) =>
        index === 0
          ? { ...target, userValue: 500, userPercentile: 26, marketStatus: "locked" as const }
          : index === 1
            ? {
                ...target,
                userValue: 400,
                marketStatus: "resolved" as const,
                actualValue: 650,
                points: 7.25,
              }
            : target,
      ),
    };
    render(<ForecastCard game={closed} isAuthenticated />);

    expect(screen.getAllByText("Locked")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows every market as Locked after a game is released", () => {
    render(<ForecastCard game={{ ...game, lifecycleStatus: "released" }} isAuthenticated />);

    expect(screen.getAllByText("Locked")).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Expand all forecasts for Input Limit Test" }),
    );
    expect(screen.getAllByText("Locked")).toHaveLength(4);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
