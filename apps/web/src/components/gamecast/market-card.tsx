import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import {
  formatClosingDate,
  formatCompact,
  type PublicMarket,
} from '@/lib/gamecast';

export function MarketCard({ market }: { market: PublicMarket }) {
  const yesPercent = Math.round(market.yes_price_bps / 100);
  const isResolved = market.status === 'resolved';

  return (
    <article className="market-card">
      <Link
        href={`/markets/${market.slug}`}
        className="market-card__image"
        aria-label={`Open market: ${market.question}`}
      >
        {market.header_image_url ? (
          // Steam CDN images are stored as market metadata; no user uploads.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={market.header_image_url} alt="" />
        ) : (
          <span className="market-card__fallback">{market.steam_title}</span>
        )}
        <span className="market-card__game">{market.steam_title}</span>
      </Link>

      <div className="market-card__body">
        <div className="market-card__meta">
          <span>{market.category}</span>
          <span className={`status-dot status-dot--${market.status}`}>
            {market.status}
          </span>
        </div>
        <h3>
          <Link href={`/markets/${market.slug}`}>{market.question}</Link>
        </h3>

        <div className="probability-row">
          <div>
            <span>Chance</span>
            <strong>{yesPercent}%</strong>
          </div>
          <div className="probability-track" aria-label={`${yesPercent}% yes`}>
            <span style={{ width: `${yesPercent}%` }} />
          </div>
        </div>

        <div className="market-card__footer">
          <span>
            <Clock3 aria-hidden="true" />
            {isResolved
              ? `Resolved ${market.resolved_outcome?.toUpperCase()}`
              : formatClosingDate(market.closes_at)}
          </span>
          <span>{formatCompact(market.total_volume)} played</span>
          <Link href={`/markets/${market.slug}`} aria-label="View market">
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

