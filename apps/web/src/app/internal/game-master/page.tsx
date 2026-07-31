import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { GameMasterConsole } from '@/components/staging/game-master-console';
import { requireStagingPagePrincipal, StagingAccessError } from '@/lib/staging/access';
import { getGameMasterData } from '@/lib/staging/simulation-service';

export default function GameMasterPage() {
  return <Suspense fallback={<ConsoleLoading label="Loading Game Master Console…" />}><GameMasterContent /></Suspense>;
}

async function GameMasterContent() {
  let principal;
  try {
    principal = await requireStagingPagePrincipal('game-master');
  } catch (error) {
    if (error instanceof StagingAccessError && error.status === 401) redirect('/login?next=/internal/game-master');
    if (error instanceof StagingAccessError && error.status === 404) notFound();
    return <AccessDenied message={error instanceof Error ? error.message : 'Access denied.'} />;
  }
  const data = await getGameMasterData();
  return <GameMasterConsole initialData={data} principal={principal} />;
}

function ConsoleLoading({ label }: { label: string }) {
  return <main className="gm-access-denied" aria-busy="true"><h1>{label}</h1><p>Checking staging access and loading isolated simulation state.</p></main>;
}

function AccessDenied({ message }: { message: string }) {
  return <main className="gm-access-denied"><h1>Access denied</h1><p>{message}</p><a href="/">Return to NextHit Market</a></main>;
}
