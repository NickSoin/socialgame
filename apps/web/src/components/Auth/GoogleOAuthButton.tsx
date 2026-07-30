'use client';

import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { google as GoogleIcon } from '@/components/Auth/Icons';
import { signInWithProviderAction } from '@/data/auth/auth';

export function GoogleOAuthButton({ next }: { next?: string }) {
  const [errorMessage, setErrorMessage] = useState('');
  const { execute, status } = useAction(signInWithProviderAction, {
    onExecute: () => setErrorMessage(''),
    onSuccess: ({ data }) => {
      if (data?.url) window.location.assign(data.url);
    },
    onError: ({ error }) => {
      setErrorMessage(error.serverError ?? 'Could not continue with Google.');
    },
  });

  return (
    <div className="sb-auth-alternative">
      <button
        className="sb-google-auth"
        disabled={status === 'executing'}
        onClick={() => execute({ provider: 'google', next })}
        type="button"
      >
        <GoogleIcon />
        {status === 'executing' ? 'Connecting…' : 'Continue with Google'}
      </button>
      {errorMessage && <p className="sb-auth-error" aria-live="polite">{errorMessage}</p>}
      <div className="sb-auth-divider"><span>or</span></div>
    </div>
  );
}
