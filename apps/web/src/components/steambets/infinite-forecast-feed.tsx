"use client";

import { useEffect, useRef, useState } from "react";
import { loadSteamFeedPage } from "@/data/actions/load-steam-feed-page";
import type { SteamFeedMode } from "@/lib/steam-feed";
import type { SteamUpcomingGame } from "@/lib/steam-bets";
import { ForecastFeed } from "./forecast-feed";

export function InfiniteForecastFeed({
  games: initialGames,
  hasMore: initialHasMore,
  heading,
  isAuthenticated,
  mode,
  query,
  status,
}: {
  games: SteamUpcomingGame[];
  hasMore: boolean;
  heading: string;
  isAuthenticated: boolean;
  mode: SteamFeedMode;
  query: string;
  status: "open" | "resolved";
}) {
  const [games, setGames] = useState(initialGames);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextPageRef = useRef(2);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || isLoadingRef.current) return;

        isLoadingRef.current = true;
        setIsLoading(true);
        setLoadError(false);
        const page = nextPageRef.current;

        void loadSteamFeedPage({ mode, page, query, status })
          .then((result) => {
            if (cancelled) return;
            setGames((currentGames) => {
              const loadedIds = new Set(currentGames.map((game) => game.appId));
              const newGames = result.games.filter((game) => !loadedIds.has(game.appId));
              return [...currentGames, ...newGames];
            });
            nextPageRef.current = page + 1;
            setHasMore(result.hasMore);
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            console.error("Could not load more Steam games.", error);
            setLoadError(true);
          })
          .finally(() => {
            if (cancelled) return;
            isLoadingRef.current = false;
            setIsLoading(false);
          });
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(sentinel);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [hasMore, mode, query, status]);

  return (
    <>
      <ForecastFeed games={games} heading={heading} isAuthenticated={isAuthenticated} />
      {hasMore && (
        <div
          aria-live="polite"
          className={`sb-feed-loader${isLoading ? " is-loading" : ""}`}
          ref={sentinelRef}
          role={isLoading || loadError ? "status" : undefined}
        >
          {isLoading ? (
            <>
              <span className="sb-feed-loader__spinner" aria-hidden="true" />
              <span>Loading more games…</span>
            </>
          ) : loadError ? (
            <span>Could not load more games. Scroll away and back to retry.</span>
          ) : (
            <span className="sr-only">Scroll down to load more games</span>
          )}
        </div>
      )}
    </>
  );
}
