"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SteamUpcomingGame } from "@/lib/steam-bets";
import { GameHero } from "./game-hero";

export type HeaderSearchGame = Pick<
  SteamUpcomingGame,
  "appId" | "imageUrl" | "name" | "releaseLabel" | "wishlistRank"
>;

export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryFromUrl);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<HeaderSearchGame[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const action = "/";

  useEffect(() => setQuery(queryFromUrl), [queryFromUrl]);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/games/search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search returned ${response.status}`);
        const payload = (await response.json()) as { games?: HeaderSearchGame[] };
        setSuggestions(payload.games ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Could not search games.", error);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const navigateToQuery = (nextQuery: string) => {
    const value = nextQuery.trim();
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    router.push(params.size ? `${action}?${params.toString()}` : action);
    setIsOpen(false);
  };

  return (
    <CommandPrimitive
      className="sb-search-command"
      label="Search games"
      loop
      shouldFilter={false}
      onBlur={() => {
        closeTimer.current = setTimeout(() => setIsOpen(false), 0);
      }}
      onFocus={() => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
      }}
    >
      <form
        action={action}
        className="sb-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigateToQuery(query);
        }}
      >
        <button className="sb-search__submit" type="submit" aria-label="Search games">
          <Search size={21} aria-hidden="true" />
        </button>
        <CommandPrimitive.Input
          aria-label="Search games"
          autoComplete="off"
          name="q"
          placeholder="Search games..."
          value={query}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsOpen(false);
          }}
          onValueChange={(value) => {
            setQuery(value);
            setIsOpen(true);
          }}
        />
        {query && (
          <button
            aria-label="Clear search"
            className="sb-search__clear"
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              if (queryFromUrl) navigateToQuery("");
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </form>

      {isOpen && query.trim() && (
        <CommandPrimitive.List className="sb-search-results">
          {isLoading ? (
            <div className="sb-search-empty" role="status">
              Searching games...
            </div>
          ) : suggestions.length ? (
            <CommandPrimitive.Group heading="Games">
              {suggestions.map((game) => (
                <CommandPrimitive.Item
                  className="sb-search-result"
                  key={game.appId}
                  value={`${game.name} ${game.appId}`}
                  onSelect={() => navigateToQuery(game.name)}
                >
                  <GameHero
                    appId={game.appId}
                    imageUrl={game.imageUrl}
                    name={game.name}
                    variant="search"
                    wishlistRank={game.wishlistRank}
                  />
                  <span>
                    <strong>{game.name}</strong>
                    <small>{game.releaseLabel}</small>
                  </span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          ) : (
            <CommandPrimitive.Empty className="sb-search-empty">
              No matching games
            </CommandPrimitive.Empty>
          )}
        </CommandPrimitive.List>
      )}
    </CommandPrimitive>
  );
}
