"use client";

import { useEffect, useRef } from "react";
import { getSteamGameHeroUrl, STEAM_GAME_HERO_ASPECT_RATIO } from "@/lib/steam-game-hero";

function ensureGameHero(image: HTMLImageElement, appId: number, loadEventReceived = false) {
  if (!loadEventReceived && !image.complete) return;

  const expectedUrl = getSteamGameHeroUrl(appId);
  const loadedAspectRatio = image.naturalWidth / image.naturalHeight;
  const isMissing = !image.naturalWidth || !image.naturalHeight;
  const isLegacyCapsule =
    !isMissing && Math.abs(loadedAspectRatio - STEAM_GAME_HERO_ASPECT_RATIO) > 0.03;

  if ((isMissing || isLegacyCapsule) && image.getAttribute("src") !== expectedUrl) {
    image.setAttribute("src", expectedUrl);
  }
}

export function GameHero({
  appId,
  name,
  priority = false,
  wishlistRank,
  variant = "card",
}: {
  appId: number;
  name: string;
  priority?: boolean;
  wishlistRank: number | null;
  variant?: "card" | "search";
}) {
  const artworkRef = useRef<HTMLImageElement>(null);
  const imageUrl = getSteamGameHeroUrl(appId);

  useEffect(() => {
    const image = artworkRef.current;
    if (!image) return;

    const checkArtwork = () => ensureGameHero(image, appId);
    checkArtwork();
    image.addEventListener("load", checkArtwork);
    image.addEventListener("error", checkArtwork);
    return () => {
      image.removeEventListener("load", checkArtwork);
      image.removeEventListener("error", checkArtwork);
    };
  }, [appId]);

  return (
    <div className={`sb-game-hero is-${variant}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={variant === "card" ? `${name} artwork` : ""}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        height={215}
        loading={priority ? "eager" : "lazy"}
        onError={(event) => ensureGameHero(event.currentTarget, appId, true)}
        onLoad={(event) => ensureGameHero(event.currentTarget, appId, true)}
        ref={artworkRef}
        src={imageUrl}
        width={460}
      />
      {wishlistRank !== null && (
        <span className="sb-game-hero__rank" aria-label={`Top wishlisted rank ${wishlistRank}`}>
          #{wishlistRank}
        </span>
      )}
    </div>
  );
}
