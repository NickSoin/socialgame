import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCoins } from '@/lib/gamecast';

export function CoinAmount({
  value,
  className,
  compact = false,
}: {
  value: number;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn('coin-amount', className)}>
      <Coins aria-hidden="true" />
      {compact
        ? new Intl.NumberFormat('en-GB', {
            notation: 'compact',
            maximumFractionDigits: 1,
          }).format(value)
        : formatCoins(value)}
    </span>
  );
}

