"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import { getSteamGameHeroUrl, STEAM_GAME_HERO_ASPECT_RATIO } from "@/lib/steam-game-hero";

const NO_PREVIEWS: readonly string[] = [];

function needsGameHeroFallback(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) return true;
  return Math.abs(image.naturalWidth / image.naturalHeight - STEAM_GAME_HERO_ASPECT_RATIO) > 0.03;
}

export function GameHero({
  appId,
  imageUrl,
  name,
  previewUrls = NO_PREVIEWS,
  priority = false,
  previewActive,
  wishlistRank,
  followerCount = null,
  variant = "card",
}: {
  appId: number;
  imageUrl: string;
  name: string;
  previewUrls?: readonly string[];
  priority?: boolean;
  previewActive?: boolean;
  wishlistRank: number | null;
  followerCount?: number | null;
  variant?: "card" | "search";
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [failedPreviews, setFailedPreviews] = useState<readonly string[]>([]);
  const [heroUrl, setHeroUrl] = useState(imageUrl);
  const artworkRef = useRef<HTMLImageElement>(null);
  const previews = useMemo(
    () => variant === "card" ? previewUrls.filter(Boolean).slice(0, 2) : [],
    [previewUrls, variant],
  );
  const availablePreviews = previews.filter((preview) => !failedPreviews.includes(preview));
  const isPreviewing = previewActive ?? isHovered;
  const frameUrl = frameIndex === 0 ? heroUrl : availablePreviews[frameIndex - 1];
  const isShowingPreview = isPreviewing && frameIndex > 0 && Boolean(frameUrl);

  useEffect(() => {
    setFailedPreviews([]);
    setFrameIndex(0);
    setHeroUrl(imageUrl);
  }, [appId, imageUrl, previews]);

  useEffect(() => {
    for (const preview of previews) {
      const image = new Image();
      image.decoding = "async";
      image.src = preview;
    }
  }, [previews]);

  useEffect(() => {
    const image = artworkRef.current;
    if (!isShowingPreview && image?.complete && needsGameHeroFallback(image)) {
      setHeroUrl(getSteamGameHeroUrl(appId));
    }
  }, [appId, isShowingPreview]);

  useEffect(() => {
    setFrameIndex(0);
  }, [isPreviewing]);

  useEffect(() => {
    if (!isPreviewing || availablePreviews.length === 0) return;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % (availablePreviews.length + 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [availablePreviews.length, isPreviewing]);

  return (
    <div
      className={`sb-game-hero is-${variant}${isShowingPreview ? " is-previewing" : ""}`}
      onMouseEnter={() => {
        if (previewActive !== undefined || !availablePreviews.length) return;
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (previewActive !== undefined) return;
        setIsHovered(false);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={variant === "card" ? `${name} artwork` : ""}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        height={215}
        loading={priority ? "eager" : "lazy"}
        onError={() => {
          if (isShowingPreview && frameUrl) {
            setFailedPreviews((current) => (
              current.includes(frameUrl) ? current : [...current, frameUrl]
            ));
            setFrameIndex((current) => current > availablePreviews.length - 1 ? 0 : current);
            return;
          }
          const fallback = getSteamGameHeroUrl(appId);
          if (heroUrl !== fallback) setHeroUrl(fallback);
        }}
        onLoad={(event) => {
          if (!isShowingPreview && needsGameHeroFallback(event.currentTarget)) {
            setHeroUrl(getSteamGameHeroUrl(appId));
          }
        }}
        ref={artworkRef}
        data-preview-frame={isShowingPreview ? frameIndex : 0}
        src={isShowingPreview ? frameUrl : heroUrl}
        width={460}
      />
      {(wishlistRank !== null || (variant === "card" && followerCount !== null)) && (
        <div className="sb-game-hero__metrics">
          {wishlistRank !== null && (
            <span className="sb-game-hero__rank" aria-label={`Top wishlisted rank ${wishlistRank}`}>
              #{wishlistRank}
            </span>
          )}
          {variant === "card" && followerCount !== null && (
            <span className="sb-game-hero__followers" aria-label={`${followerCount.toLocaleString("en-US")} Steam followers`}>
              <Users aria-hidden="true" size={13} strokeWidth={2.2} />
              {followerCount.toLocaleString("en-US")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
