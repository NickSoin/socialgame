'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { signInWithPasswordAction } from '@/data/auth/auth';
import { sanitizeAuthRedirect } from '@/utils/auth-redirect';
import { GoogleOAuthButton } from '@/components/Auth/GoogleOAuthButton';

export function Login({ next }: { next?: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');
  const { execute, status } = useAction(signInWithPasswordAction, {
    onExecute: () => setErrorMessage(''),
    onSuccess: () => {
      router.replace(sanitizeAuthRedirect(next));
      router.refresh();
    },
    onError: ({ error }) => setErrorMessage(error.serverError ?? 'Could not sign in.'),
  });

  return (
    <section className="sb-auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">Sign in</h1>
      <GoogleOAuthButton next={next} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          execute({ email: String(data.get('email')), password: String(data.get('password')) });
        }}
      >
        <label>Email<input autoComplete="email" name="email" required type="email" /></label>
        <label>Password<input autoComplete="current-password" name="password" required type="password" /></label>
        {errorMessage && <p className="sb-auth-error" aria-live="polite">{errorMessage}</p>}
        <button disabled={status === 'executing'} type="submit">
          {status === 'executing' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="sb-auth-links">
        <Link href="/forgot-password">Forgot password?</Link>
        <span>New here? <Link href={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}>Register</Link></span>
      </div>
    </section>
  );
}
