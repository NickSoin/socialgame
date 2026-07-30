'use client';

import { useAction } from 'next-safe-action/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resolveMarketAction } from '@/data/actions/gamecast-actions';
import type { PublicMarket } from '@/lib/gamecast';

export function MarketResolver({ market }: { market: PublicMarket }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const { execute, status } = useAction(resolveMarketAction, {
    onExecute: () => setMessage(null),
    onSuccess: () => {
      setMessage('Market settled.');
      router.refresh();
    },
    onError: ({ error }) =>
      setMessage(error.serverError ?? 'Resolution failed.'),
  });

  if (market.status === 'resolved') {
    return (
      <span className={`outcome-chip outcome-chip--${market.resolved_outcome}`}>
        {market.resolved_outcome?.toUpperCase()}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        className="button-secondary !min-h-0 !py-2 text-[var(--yes)]"
        type="button"
        disabled={status === 'executing'}
        onClick={() =>
          execute({
            marketId: market.id,
            marketSlug: market.slug,
            outcome: 'yes',
          })
        }
      >
        Resolve YES
      </button>
      <button
        className="button-secondary !min-h-0 !py-2 text-[var(--no)]"
        type="button"
        disabled={status === 'executing'}
        onClick={() =>
          execute({
            marketId: market.id,
            marketSlug: market.slug,
            outcome: 'no',
          })
        }
      >
        Resolve NO
      </button>
      {message && <small className="text-muted-foreground">{message}</small>}
    </div>
  );
}

