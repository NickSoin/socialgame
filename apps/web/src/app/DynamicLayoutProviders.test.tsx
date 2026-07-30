import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicLayoutProviders } from './DynamicLayoutProviders';

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('sonner', () => ({
  Toaster: () => null,
}));

vi.mock('next-nprogress-bar', () => ({
  AppProgressBar: (props: {
    color: string;
    height: string;
    startOnLoad?: boolean;
    startPosition?: number;
  }) => (
    <div
      data-color={props.color}
      data-height={props.height}
      data-start-on-load={String(props.startOnLoad)}
      data-start-position={String(props.startPosition)}
      data-testid="page-progress"
    />
  ),
}));

afterEach(cleanup);

describe('DynamicLayoutProviders', () => {
  it('shows a thin top progress bar for initial and client-side page loads', () => {
    render(
      <DynamicLayoutProviders>
        <main>Page</main>
      </DynamicLayoutProviders>,
    );

    const progress = screen.getByTestId('page-progress');
    expect(progress.getAttribute('data-color')).toBe('#1452f0');
    expect(progress.getAttribute('data-height')).toBe('2px');
    expect(progress.getAttribute('data-start-on-load')).toBe('true');
    expect(progress.getAttribute('data-start-position')).toBe('0.08');
  });
});
