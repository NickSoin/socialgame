'use client';

import { Search } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function HeaderSearch() {
  const pathname = usePathname();
  const action = ['/', '/trending', '/involved'].includes(pathname) ? pathname : '/';

  return (
    <form action={action} className="sb-search" role="search">
      <button className="sb-search__submit" type="submit" aria-label="Search games">
        <Search size={21} aria-hidden="true" />
      </button>
      <input
        aria-label="Search games"
        autoComplete="off"
        name="q"
        placeholder="Search games…"
        type="search"
      />
    </form>
  );
}
