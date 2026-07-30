import Link from 'next/link';
import { Brand } from '@/components/gamecast/brand';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-shell site-footer__inner">
        <Brand compact />
        <span>Community Steam forecasts · Not affiliated with Valve</span>
        <Link href="/leaderboards">Leaderboards</Link>
      </div>
    </footer>
  );
}
