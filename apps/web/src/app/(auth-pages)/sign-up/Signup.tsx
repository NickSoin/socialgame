'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { signUpAction } from '@/data/auth/auth';
import { sanitizeAuthRedirect } from '@/utils/auth-redirect';
import { GoogleOAuthButton } from '@/components/Auth/GoogleOAuthButton';

export function SignUp({ next }: { next?: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationPending, setConfirmationPending] = useState(false);
  const { execute, status } = useAction(signUpAction, {
    onExecute: () => setErrorMessage(''),
    onSuccess: ({ data }) => {
      if (data?.session) {
        router.replace(sanitizeAuthRedirect(next));
        router.refresh();
      } else {
        setConfirmationPending(true);
      }
    },
    onError: ({ error }) => setErrorMessage(error.serverError ?? 'Could not create account.'),
  });

  if (confirmationPending) {
    return (
      <section className="sb-auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">Check your email</h1>
        <p className="sb-auth-note">Use the confirmation link to finish creating your NextHit Market account.</p>
        <Link
          className="sb-auth-primary-link"
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
        >
          Back to sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="sb-auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">Register</h1>
      <GoogleOAuthButton next={next} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          execute({
            email: String(data.get('email')),
            password: String(data.get('password')),
            next,
          });
        }}
      >
        <label>Email<input autoComplete="email" name="email" required type="email" /></label>
        <label>Password<input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
        <p className="sb-auth-hint">At least 8 characters.</p>
        {errorMessage && <p className="sb-auth-error" aria-live="polite">{errorMessage}</p>}
        <button disabled={status === 'executing'} type="submit">
          {status === 'executing' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <div className="sb-auth-links">
        <span>Already registered? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link></span>
      </div>
    </section>
  );
}
