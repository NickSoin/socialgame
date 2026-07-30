import Link from 'next/link';
import { ChevronDown, LogIn, LogOut, UserRound, UserPlus } from 'lucide-react';
import { signOutAction } from '@/data/auth/sign-out';
import type { NavbarViewer } from '@/data/navbar';

export function AccountMenu({ viewer }: { viewer: NavbarViewer }) {
  if (!viewer) {
    return (
      <details className="sb-account-menu">
        <summary aria-label="Account menu"><UserRound size={23} aria-hidden="true" /></summary>
        <div className="sb-account-menu__panel">
          <Link href="/login"><LogIn size={17} aria-hidden="true" />Sign in</Link>
          <Link href="/sign-up"><UserPlus size={17} aria-hidden="true" />Register</Link>
        </div>
      </details>
    );
  }

  return (
    <details className="sb-account-menu">
      <summary aria-label={`Account menu for ${viewer.username}`}>
        <span className="sb-account-menu__avatar"><UserRound size={21} aria-hidden="true" /></span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="sb-account-menu__panel">
        <Link href={`/@${viewer.username}`}><UserRound size={17} aria-hidden="true" />@{viewer.username}</Link>
        <form action={signOutAction}>
          <button type="submit"><LogOut size={17} aria-hidden="true" />Sign out</button>
        </form>
      </div>
    </details>
  );
}
