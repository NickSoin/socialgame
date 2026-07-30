import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoogleOAuthButton } from './GoogleOAuthButton';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('next-safe-action/hooks', () => ({
  useAction: () => ({ execute: mocks.execute, status: 'idle' }),
}));

vi.mock('@/data/auth/auth', () => ({ signInWithProviderAction: {} }));

describe('GoogleOAuthButton', () => {
  it('starts the Google flow and preserves the requested destination', () => {
    render(<GoogleOAuthButton next="/involved" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(mocks.execute).toHaveBeenCalledWith({ provider: 'google', next: '/involved' });
  });
});
