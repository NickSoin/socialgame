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
  name: "Input Limit Test",
  releaseDate: "2026-08-01",
  releaseLabel: "August 1",
  tags: ["Action", "RPG", "Singleplayer"],
  wishlistRank: 77,
  targets: STEAM_BET_TARGETS.map((target) => ({
    ...target,
    averageValue: 200,
    predictionCount: 7_000_000,
    userValue: null,
  })),
};

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ForecastCard", () => {
  it("shows the average and volume beside each compact prediction input", () => {
    render(<ForecastCard game={game} isAuthenticated />);

    expect(screen.getAllByText("200 Avg.")).toHaveLength(3);
    expect(screen.getAllByText("7M Vol.")).toHaveLength(3);
    expect(screen.getByText("August 1").getAttribute("dateTime")).toBe("2026-08-01");
    expect(screen.getByLabelText("Top wishlisted rank 77").textContent).toBe("#77");
    expect(screen.getByText("Action · RPG · Singleplayer")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open Input Limit Test on Steam" }).getAttribute("href"),
    ).toBe("https://store.steampowered.com/app/42/");
    expect(document.querySelector('img[src*="favicon"]')).toBeNull();
  });

  it("cycles hero and two screenshots while the clickable card is hovered", () => {
    vi.useFakeTimers();
    const previewGame = { ...game, appId: 1368140, name: "Corsair Cove" };
    const { container } = render(<ForecastCard game={previewGame} isAuthenticated />);
    const card = container.querySelector(".sb-game-card") as HTMLElement;
    const artwork = screen.getByRole("img", { name: "Corsair Cove artwork" });

    fireEvent.mouseEnter(card);
    expect(artwork.getAttribute("src")).toBe(getSteamGameHeroUrl(1368140));
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe("/game-previews/1368140-1.webp");
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe("/game-previews/1368140-2.webp");
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(getSteamGameHeroUrl(1368140));
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

  it("enforces the target-specific character limits while typing", () => {
    render(<ForecastCard game={game} isAuthenticated />);

    const ccu = screen.getByRole("textbox", {
      name: "First weekend peak CCU for Input Limit Test",
    }) as HTMLInputElement;
    const reviews = screen.getByRole("textbox", {
      name: "First month total reviews for Input Limit Test",
    }) as HTMLInputElement;
    const price = screen.getByRole("textbox", {
      name: "Full price in US for Input Limit Test",
    }) as HTMLInputElement;

    expect(ccu.maxLength).toBe(7);
    expect(reviews.maxLength).toBe(6);
    expect(price.maxLength).toBe(7);

    fireEvent.change(ccu, { target: { value: "123456789" } });
    fireEvent.change(reviews, { target: { value: "987654321" } });
    fireEvent.change(price, { target: { value: "123,4567" } });

    expect(ccu.value).toBe("1234567");
    expect(reviews.value).toBe("987654");
    expect(price.value).toBe("123.456");
  });

  it("submits the bounded draft instead of a lossy number-input value", () => {
    render(<ForecastCard game={game} isAuthenticated />);

    const ccu = screen.getByRole("textbox", {
      name: "First weekend peak CCU for Input Limit Test",
    });
    fireEvent.focus(ccu);
    fireEvent.change(ccu, { target: { value: "12345678" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm First weekend peak CCU prediction" }),
    );

    expect(mocks.execute).toHaveBeenCalledWith({
      steamAppId: 42,
      targetKey: "first_weekend_ccu",
      value: "1234567",
    });
  });

  it("cancels a draft without submitting it", () => {
    render(<ForecastCard game={game} isAuthenticated />);

    const ccu = screen.getByRole("textbox", {
      name: "First weekend peak CCU for Input Limit Test",
    }) as HTMLInputElement;
    fireEvent.focus(ccu);
    fireEvent.change(ccu, { target: { value: "9000" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel First weekend peak CCU prediction" }),
    );

    expect(ccu.value).toBe("");
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Confirm First weekend peak CCU prediction" }),
    ).toBeNull();
  });
});
