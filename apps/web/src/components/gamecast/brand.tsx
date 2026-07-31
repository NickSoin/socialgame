import Link from 'next/link';

export function Brand({ compact = false, href = '/' }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="sb-wordmark" aria-label="NextHit Market home">
      NextHit Market{compact ? '' : ''}
    </Link>
  );
}
