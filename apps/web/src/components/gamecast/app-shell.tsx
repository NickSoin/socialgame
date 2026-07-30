'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import {
  BarChart3,
  Coins,
  Gamepad2,
  Gauge,
  LogOut,
  Settings2,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Brand } from './brand';
import { CoinAmount } from './coin';
import { GameAvatar } from './game-avatar';
import type { PublicProfile } from '@/lib/gamecast';
import { signOutAction } from '@/data/auth/sign-out';

const baseNavigation = [
  { title: 'Dashboard', href: '/dashboard', icon: Gauge },
  { title: 'Markets', href: '/#markets', icon: Gamepad2 },
  { title: 'Leaderboards', href: '/leaderboards', icon: Trophy },
  { title: 'Profile', href: '/settings/profile', icon: Settings2 },
];

export function AppShell({
  user,
  profile,
  children,
}: {
  user: User;
  profile: PublicProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const navigation = profile.is_admin
    ? [
        ...baseNavigation,
        { title: 'Resolve', href: '/admin/markets', icon: ShieldCheck },
      ]
    : baseNavigation;

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Brand compact />
        <nav className="app-sidebar__nav" aria-label="Application navigation">
          {navigation.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === item.href
                : item.href.startsWith('/') && item.href !== '/#markets'
                  ? pathname.startsWith(item.href)
                  : false;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} data-active={active}>
                <Icon aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
        <div className="app-sidebar__foot">
          <div className="app-user">
            <GameAvatar avatarId={profile.avatar_id} size="sm" />
            <div>
              <strong>{profile.display_name}</strong>
              <span>{user.email}</span>
            </div>
            <button
              className="button-ghost !p-2 !min-h-0"
              type="button"
              title="Sign out"
              disabled={isPending}
              onClick={() => startTransition(() => signOutAction())}
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="eyebrow">Play-money account</span>
            <h1>{profile.display_name}</h1>
          </div>
          <div className="app-topbar__meta">
            <span className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 size={14} aria-hidden="true" />
              {profile.total_predictions} calls
            </span>
            <CoinAmount value={profile.coin_balance} />
            <Coins size={15} className="text-primary" aria-hidden="true" />
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

