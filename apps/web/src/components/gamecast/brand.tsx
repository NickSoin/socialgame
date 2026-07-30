import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="sb-wordmark" aria-label="SteamBets home">
      SteamBets{compact ? '' : ''}
    </Link>
  );
}
