'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAction } from 'next-safe-action/hooks';
import { useRouter } from 'next/navigation';
import { placePredictionAction } from '@/data/actions/gamecast-actions';
import { calculatePredictionQuote } from '@/lib/prediction-math';
import { formatCoins, type MarketOutcome, type PublicMarket } from '@/lib/gamecast';

export function PredictionTicket({
  market,
  balance,
  isAuthenticated,
  initialOutcome = 'yes',
}: {
  market: PublicMarket;
  balance: number;
  isAuthenticated: boolean;
  initialOutcome?: MarketOutcome;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<MarketOutcome>(initialOutcome);
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const quote = useMemo(() => {
    try {
      return calculatePredictionQuote({
        stake,
        yesPriceBps: market.yes_price_bps,
        outcome: outcome.toUpperCase() as 'YES' | 'NO',
      });
    } catch {
      return null;
    }
  }, [market.yes_price_bps, outcome, stake]);

  const { execute, status } = useAction(placePredictionAction, {
    onExecute: () => setMessage(null),
    onSuccess: () => {
      setMessage({
        type: 'success',
        text: 'Prediction placed.',
      });
      router.refresh();
    },
    onError: ({ error }) => {
      setMessage({
        type: 'error',
        text: error.serverError ?? 'The prediction could not be placed.',
      });
    },
  });

  const isOpen = market.status === 'open';
  const isValid = quote && stake <= balance && stake > 0;

  return (
    <aside className="trade-ticket">
      <div className="trade-ticket__head">
        <div>
          <h2>Trade</h2>
          <span>{market.steam_title}</span>
        </div>
        <span className="trade-ticket__balance">{formatCoins(balance)} coins</span>
      </div>

      <div className="outcome-toggle" aria-label="Choose prediction outcome">
        <label className="outcome-toggle__yes">
          <input
            type="radio"
            name="prediction-outcome"
            value="yes"
            checked={outcome === 'yes'}
            onChange={() => setOutcome('yes')}
          />
          <span>Yes {Math.round(market.yes_price_bps / 100)}%</span>
        </label>
        <label className="outcome-toggle__no">
          <input
            type="radio"
            name="prediction-outcome"
            value="no"
            checked={outcome === 'no'}
            onChange={() => setOutcome('no')}
          />
          <span>No {100 - Math.round(market.yes_price_bps / 100)}%</span>
        </label>
      </div>

      <div className="field-stack">
        <label htmlFor="prediction-stake">Amount</label>
        <input
          id="prediction-stake"
          inputMode="numeric"
          min={1}
          max={Math.max(balance, 1)}
          step={1}
          type="number"
          value={stake}
          onChange={(event) => setStake(Number(event.target.value))}
        />
      </div>

      <div className="quick-stakes" aria-label="Quick stake amounts">
        {[25, 100, 250, 500].map((amount) => (
          <button key={amount} type="button" onClick={() => setStake(amount)}>
            {amount}
          </button>
        ))}
      </div>

      <div className="trade-summary">
        <div>
          <span>Locked price</span>
          <strong>{quote?.displayedPercentage ?? '—'}</strong>
        </div>
        <div>
          <span>Potential payout</span>
          <strong>{quote ? formatCoins(quote.potentialPayout) : '—'}</strong>
        </div>
        <div>
          <span>Potential profit</span>
          <strong>{quote ? `+${formatCoins(quote.potentialProfit)}` : '—'}</strong>
        </div>
      </div>

      {!isAuthenticated ? (
        <Link
          href={`/login?next=${encodeURIComponent(`/event/${market.slug}`)}`}
          className="button-primary"
        >
          Sign in to predict
        </Link>
      ) : (
        <button
          type="button"
          className="button-primary"
          disabled={!isOpen || !isValid || status === 'executing'}
          onClick={() =>
            execute({
              marketId: market.id,
              marketSlug: market.slug,
              outcome,
              stake,
            })
          }
        >
          {status === 'executing'
            ? 'Placing…'
            : isOpen
              ? `Buy ${outcome === 'yes' ? 'Yes' : 'No'}`
              : 'Market resolved'}
        </button>
      )}

      {isAuthenticated && stake > balance && (
        <p className="form-message form-message--error">
          Your stake is higher than your available balance.
        </p>
      )}
      {message && (
        <p className={`form-message form-message--${message.type}`}>
          {message.text}
        </p>
      )}
    </aside>
  );
}
