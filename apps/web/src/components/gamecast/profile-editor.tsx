'use client';

import { useState } from 'react';
import { useAction } from 'next-safe-action/hooks';
import { useRouter } from 'next/navigation';
import { updateProfileAction } from '@/data/actions/gamecast-actions';
import { AVATARS, type AvatarId, type PublicProfile } from '@/lib/gamecast';
import { GameAvatar } from './game-avatar';

export function ProfileEditor({ profile }: { profile: PublicProfile }) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [avatarId, setAvatarId] = useState<AvatarId>(profile.avatar_id);
  const [website, setWebsite] = useState(profile.links.website ?? '');
  const [steam, setSteam] = useState(profile.links.steam ?? '');
  const [twitch, setTwitch] = useState(profile.links.twitch ?? '');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const { execute, status } = useAction(updateProfileAction, {
    onExecute: () => setMessage(null),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Profile saved.' });
      router.refresh();
    },
    onError: ({ error }) =>
      setMessage({
        type: 'error',
        text: error.serverError ?? 'Profile could not be saved.',
      }),
  });

  return (
    <form
      className="profile-editor"
      onSubmit={(event) => {
        event.preventDefault();
        execute({
          username,
          displayName,
          bio,
          avatarId,
          website,
          steam,
          twitch,
        });
      }}
    >
      <section className="form-card">
        <h2>Public identity</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="field-stack">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              minLength={3}
              maxLength={24}
              pattern="[a-z0-9_]+"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              required
            />
          </div>
          <div className="field-stack">
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              maxLength={48}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="field-stack">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            maxLength={240}
            rows={4}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="field-stack">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="url"
              placeholder="https://…"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="steam-link">Steam profile</label>
            <input
              id="steam-link"
              type="url"
              placeholder="https://steamcommunity.com/…"
              value={steam}
              onChange={(event) => setSteam(event.target.value)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="twitch-link">Twitch</label>
            <input
              id="twitch-link"
              type="url"
              placeholder="https://twitch.tv/…"
              value={twitch}
              onChange={(event) => setTwitch(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="form-card">
        <h2>Profile badge</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose a simple badge. SteamBets does not use profile photos.
        </p>
        <div className="avatar-picker">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              data-selected={avatarId === avatar.id}
              onClick={() => setAvatarId(avatar.id)}
              aria-pressed={avatarId === avatar.id}
            >
              <GameAvatar avatarId={avatar.id} size="md" />
              <small>{avatar.label}</small>
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="button-primary w-full mt-5"
          disabled={status === 'executing'}
        >
          {status === 'executing' ? 'Saving…' : 'Save profile'}
        </button>
        {message && (
          <p className={`form-message form-message--${message.type}`}>
            {message.text}
          </p>
        )}
      </section>
    </form>
  );
}
