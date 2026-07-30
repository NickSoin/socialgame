'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SteamUpcomingGame } from '@/lib/steam-bets';

export type HeaderSearchGame = Pick<
  SteamUpcomingGame,
  'appId' | 'imageUrl' | 'name' | 'releaseLabel'
>;

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-US');
}

export function HeaderSearch({ games }: { games: HeaderSearchGame[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(queryFromUrl);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const action = ['/', '/trending', '/involved'].includes(pathname) ? pathname : '/';

  useEffect(() => setQuery(queryFromUrl), [queryFromUrl]);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query.trim());
    if (!normalizedQuery) return [];

    return games
      .filter((game) => normalizeSearchValue(game.name).includes(normalizedQuery))
      .slice(0, 7);
  }, [games, query]);

  const navigateToQuery = (nextQuery: string) => {
    const value = nextQuery.trim();
    const params = new URLSearchParams();
    if (value) params.set('q', value);
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
            if (event.key === 'Escape') setIsOpen(false);
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
              setQuery('');
              setIsOpen(false);
              if (queryFromUrl) navigateToQuery('');
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </form>

      {isOpen && query.trim() && (
        <CommandPrimitive.List className="sb-search-results">
          {suggestions.length ? (
            <CommandPrimitive.Group heading="Games">
              {suggestions.map((game) => (
                <CommandPrimitive.Item
                  className="sb-search-result"
                  key={game.appId}
                  value={`${game.name} ${game.appId}`}
                  onSelect={() => navigateToQuery(game.name)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" height={38} src={game.imageUrl} width={100} />
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
