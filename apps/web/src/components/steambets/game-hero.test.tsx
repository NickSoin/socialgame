import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameHero } from "./game-hero";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GameHero hover previews", () => {
  const imageUrl = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1368140/header.jpg";
  const previewUrls = ["/storage/1368140-1.webp", "/storage/1368140-2.webp"];

  it("cycles every frame across repeated hovers and restores the hero on mouse leave", () => {
    vi.useFakeTimers();
    const { container } = render(
      <GameHero appId={1368140} imageUrl={imageUrl} name="Corsair Cove" previewUrls={previewUrls} wishlistRank={77} />,
    );
    const hero = container.querySelector(".sb-game-hero") as HTMLElement;
    const artwork = screen.getByRole("img", { name: "Corsair Cove artwork" });
    const heroUrl = imageUrl;

    expect(artwork.getAttribute("src")).toBe(heroUrl);

    fireEvent.mouseEnter(hero);
    expect(artwork.getAttribute("src")).toBe(heroUrl);

    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewUrls[0]);
    fireEvent.load(artwork);
    expect(artwork.getAttribute("src")).toBe(previewUrls[0]);

    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewUrls[1]);
    fireEvent.load(artwork);
    expect(artwork.getAttribute("src")).toBe(previewUrls[1]);

    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(heroUrl);

    fireEvent.mouseLeave(hero);
    expect(artwork.getAttribute("src")).toBe(heroUrl);

    fireEvent.mouseEnter(hero);
    expect(artwork.getAttribute("src")).toBe(heroUrl);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewUrls[0]);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewUrls[1]);
  });

  it("skips a failed preview without stopping the remaining carousel", () => {
    vi.useFakeTimers();
    const { container } = render(
      <GameHero appId={1368140} imageUrl={imageUrl} name="Corsair Cove" previewUrls={previewUrls} wishlistRank={77} />,
    );
    const hero = container.querySelector(".sb-game-hero") as HTMLElement;
    const artwork = screen.getByRole("img", { name: "Corsair Cove artwork" });

    fireEvent.mouseEnter(hero);
    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(previewUrls[0]);

    fireEvent.error(artwork);
    expect(artwork.getAttribute("src")).toBe(previewUrls[1]);

    act(() => vi.advanceTimersByTime(1000));
    expect(artwork.getAttribute("src")).toBe(imageUrl);
  });

  it("keeps the normal hero for games outside the preview pilot", () => {
    const { container } = render(<GameHero appId={42} imageUrl="https://example.com/42.jpg" name="Other game" wishlistRank={null} />);
    fireEvent.mouseEnter(container.querySelector(".sb-game-hero") as HTMLElement);

    expect(screen.getByRole("img", { name: "Other game artwork" }).getAttribute("src")).toBe(
      "https://example.com/42.jpg",
    );
  });
});
