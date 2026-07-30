import { Brand } from '@/components/gamecast/brand';
import { AccountMenu } from '@/components/steambets/account-menu';
import { HeaderSearch } from '@/components/steambets/header-search';
import { HomeTabs } from '@/components/steambets/home-tabs';
import { getNavbarViewer } from '@/data/navbar';

export default async function Navbar() {
  const viewer = await getNavbarViewer();
  return (
    <header className="sb-header">
      <a className="sb-skip-link" href="#main-content">Skip to games</a>
      <div className="sb-shell sb-header__inner">
        <Brand />
        <HeaderSearch />
        <div className="sb-header-stats" aria-label="Your stats">
          <span><strong>Bets</strong><b>{viewer?.bets ?? 0}</b></span>
          <span><strong>Wins</strong><b>{viewer?.wins ?? 0}</b></span>
        </div>
        <AccountMenu viewer={viewer} />
      </div>
      <nav className="sb-categories" aria-label="Game list">
        <HomeTabs />
      </nav>
    </header>
  );
}
