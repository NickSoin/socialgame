"use client";

import { useEffect, useRef, useState } from "react";
import { getSteamGameHeroUrl, STEAM_GAME_HERO_ASPECT_RATIO } from "@/lib/steam-game-hero";
import { getSteamHoverPreviews } from "@/lib/steam-hover-previews";

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
  previewActive,
  wishlistRank,
  variant = "card",
}: {
  appId: number;
  name: string;
  priority?: boolean;
  previewActive?: boolean;
  wishlistRank: number | null;
  variant?: "card" | "search";
}) {
  const artworkRef = useRef<HTMLImageElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const imageUrl = getSteamGameHeroUrl(appId);
  const previews = variant === "card" ? getSteamHoverPreviews(appId) : [];
  const isPreviewing = previewActive ?? isHovered;
  const frameUrl = frameIndex === 0 ? imageUrl : previews[frameIndex - 1];
  const isShowingPreview = isPreviewing && frameIndex > 0 && Boolean(frameUrl);

  useEffect(() => {
    if (isShowingPreview) return;

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
  }, [appId, isShowingPreview]);

  useEffect(() => {
    setFrameIndex(0);
    if (!isPreviewing || previews.length === 0) return;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % (previews.length + 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPreviewing, previews.length]);

  return (
    <div
      className={`sb-game-hero is-${variant}${isShowingPreview ? " is-previewing" : ""}`}
      onMouseEnter={() => {
        if (!previews.length) return;
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setFrameIndex(0);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={variant === "card" ? `${name} artwork` : ""}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        height={215}
        loading={priority ? "eager" : "lazy"}
        onError={(event) => {
          if (isShowingPreview) {
            setFrameIndex(0);
            return;
          }
          ensureGameHero(event.currentTarget, appId, true);
        }}
        onLoad={(event) => {
          if (!isShowingPreview) ensureGameHero(event.currentTarget, appId, true);
        }}
        ref={artworkRef}
        src={isShowingPreview ? frameUrl : imageUrl}
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
