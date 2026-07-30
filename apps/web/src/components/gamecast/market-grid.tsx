import { MarketCard } from './market-card';
import type { PublicMarket } from '@/lib/gamecast';

export function MarketGrid({ markets }: { markets: PublicMarket[] }) {
  if (markets.length === 0) {
    return (
      <div className="empty-state">
        <span>0 live markets</span>
        <h3>The next lobby is being prepared.</h3>
        <p>New Steam prediction markets will appear here.</p>
      </div>
    );
  }

  return (
    <div className="market-grid">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
