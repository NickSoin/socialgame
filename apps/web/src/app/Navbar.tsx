import Link from "next/link";
import { Brand } from "@/components/gamecast/brand";
import { AccountMenu } from "@/components/steambets/account-menu";
import { HeaderSearch } from "@/components/steambets/header-search";
import { HomeTabs } from "@/components/steambets/home-tabs";
import { getNavbarViewer } from "@/data/navbar";

export default async function Navbar() {
  const viewer = await getNavbarViewer();

  return (
    <header className="sb-header">
      <a className="sb-skip-link" href="#main-content">
        Skip to games
      </a>
      <div className={`sb-shell sb-header__inner${viewer ? "" : " is-guest"}`}>
        <Brand />
        <HeaderSearch />
        {viewer ? (
          <>
            <div className="sb-header-stats" aria-label="Your stats">
              <span>
                <strong>Bets</strong>
                <b>{viewer.bets}</b>
              </span>
              <span>
                <strong>Points</strong>
                <b>{Math.round(viewer.points * 10) / 10}</b>
              </span>
            </div>
            <AccountMenu viewer={viewer} />
          </>
        ) : (
          <div className="sb-header-auth" aria-label="Authentication">
            <Link className="sb-login-button" href="/login">
              Log In
            </Link>
            <Link className="sb-signup-button" href="/sign-up">
              Sign Up
            </Link>
          </div>
        )}
      </div>
      <nav className="sb-categories" aria-label="Game list">
        <HomeTabs />
      </nav>
    </header>
  );
}
