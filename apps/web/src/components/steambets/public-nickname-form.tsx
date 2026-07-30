'use client';

import { useAction } from 'next-safe-action/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updatePublicNicknameAction } from '@/data/actions/gamecast-actions';

export function PublicNicknameForm({ nickname }: { nickname: string }) {
  const router = useRouter();
  const [value, setValue] = useState(nickname);
  const [savedValue, setSavedValue] = useState(nickname);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const { execute, status } = useAction(updatePublicNicknameAction, {
    onExecute: () => setMessage(null),
    onSuccess: ({ data }) => {
      const savedNickname = data?.nickname ?? value.trim();
      setValue(savedNickname);
      setSavedValue(savedNickname);
      setMessage({ type: 'success', text: 'Nickname saved.' });
      router.refresh();
    },
    onError: ({ error }) =>
      setMessage({
        type: 'error',
        text: error.serverError ?? 'Nickname could not be saved.',
      }),
  });

  const normalizedValue = value.trim();
  const isSaving = status === 'executing';

  return (
    <form
      className="sb-nickname-form"
      onSubmit={(event) => {
        event.preventDefault();
        execute({ nickname: value });
      }}
    >
      <label htmlFor="public-nickname">Public nickname</label>
      <p>This is the name other NextHit Market players will see.</p>
      <div className="sb-nickname-form__controls">
        <input
          autoComplete="nickname"
          id="public-nickname"
          maxLength={50}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage(null);
          }}
          required
          value={value}
        />
        <button
          disabled={
            isSaving || !normalizedValue || normalizedValue === savedValue
          }
          type="submit"
        >
          {isSaving ? 'Saving…' : 'Save nickname'}
        </button>
      </div>
      {message && (
        <span
          className={`sb-nickname-form__message is-${message.type}`}
          aria-live="polite"
        >
          {message.text}
        </span>
      )}
    </form>
  );
}
