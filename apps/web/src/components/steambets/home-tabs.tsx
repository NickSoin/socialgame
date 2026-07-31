'use client';

import Link from 'next/link';
import { CalendarDays, CircleDot, TrendingUp } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function HomeTabs() {
  const pathname = usePathname();
  const links = [
    { href: '/trending', label: 'Trending', icon: TrendingUp },
    { href: '/', label: 'Popular upcoming', icon: CalendarDays },
    { href: '/involved', label: 'My forecasts', icon: CircleDot },
  ];

  return (
    <div className="sb-shell sb-categories__inner">
      {links.map(({ href, icon: Icon, label }) => (
        <Link className={pathname === href ? 'is-active' : undefined} href={href} key={href}>
          <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </div>
  );
}
