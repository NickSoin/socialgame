import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSteamGameHeroUrl } from "@/lib/steam-game-hero";
import { GameHero } from "./game-hero";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GameHero hover previews", () => {
  it("cycles local screenshots every second and restores the hero on mouse leave", () => {
    vi.useFakeTimers();
    const { container } = render(
      <GameHero appId={1368140} name="Corsair Cove" wishlistRank={77} />,
    );
    const hero = container.querySelector(".sb-game-hero") as HTMLElement;
    const artwork = screen.getByRole("img", { name: "Corsair Cove artwork" });
    const heroUrl = getSteamGameHeroUrl(1368140);

    expect(artwork.getAttribute("src")).toBe(heroUrl);

    fireEvent.mouseEnter(hero);
    expect(artwork.getAttribute("src")).toBe(heroUrl);

    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe("/game-previews/1368140-1.webp");

    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe("/game-previews/1368140-2.webp");

    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(heroUrl);

    fireEvent.mouseLeave(hero);
    expect(artwork.getAttribute("src")).toBe(heroUrl);
  });

  it("keeps the normal hero for games outside the preview pilot", () => {
    const { container } = render(<GameHero appId={42} name="Other game" wishlistRank={null} />);
    fireEvent.mouseEnter(container.querySelector(".sb-game-hero") as HTMLElement);

    expect(screen.getByRole("img", { name: "Other game artwork" }).getAttribute("src")).toBe(
      getSteamGameHeroUrl(42),
    );
  });
});
