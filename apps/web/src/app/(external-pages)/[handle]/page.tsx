import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PublicNicknameForm } from '@/components/steambets/public-nickname-form';
import { getCurrentUserContext, getProfileByUsername } from '@/data/gamecast';

async function PublicProfileContent({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: encodedHandle } = await params;
  const handle = decodeURIComponent(encodedHandle);
  if (!handle.startsWith('@') || handle.length < 2) notFound();
  const [profile, viewer] = await Promise.all([
    getProfileByUsername(handle.slice(1)),
    getCurrentUserContext(),
  ]);
  if (!profile) notFound();
  const isOwner = viewer.user?.id === profile.id;

  return (
    <main id="main-content" className="sb-shell sb-profile-page">
      <section className="sb-profile-card" aria-labelledby="profile-name">
        <div className="sb-profile-card__identity">
          <h1 id="profile-name">{profile.display_name}</h1>
          <p>@{profile.username}</p>
        </div>
        {isOwner && <PublicNicknameForm nickname={profile.display_name} />}
      </section>
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
