import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="sb-wordmark" aria-label="NextHit Market home">
      NextHit Market{compact ? '' : ''}
    </Link>
  );
}
