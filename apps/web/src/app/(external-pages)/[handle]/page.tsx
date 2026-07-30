import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getProfileByUsername } from '@/data/gamecast';

async function PublicProfileContent({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: encodedHandle } = await params;
  const handle = decodeURIComponent(encodedHandle);
  if (!handle.startsWith('@') || handle.length < 2) notFound();
  const profile = await getProfileByUsername(handle.slice(1));
  if (!profile) notFound();

  return (
    <main id="main-content" className="sb-profile-empty">
      <h1 className="sr-only">@{profile.username}</h1>
    </main>
  );
}

export default function PublicProfilePage(props: { params: Promise<{ handle: string }> }) {
  return (
    <Suspense fallback={<main id="main-content" className="sb-profile-empty" />}>
      <PublicProfileContent {...props} />
    </Suspense>
  );
}
