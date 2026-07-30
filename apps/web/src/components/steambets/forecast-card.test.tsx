import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STEAM_BET_TARGETS, type SteamUpcomingGame } from '@/lib/steam-bets';
import { ForecastCard } from './forecast-card';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('next-safe-action/hooks', () => ({
  useAction: () => ({ execute: mocks.execute, status: 'idle' }),
}));

vi.mock('@/data/actions/gamecast-actions', () => ({
  placeSteamBetAction: {},
}));

const game: SteamUpcomingGame = {
  appId: 42,
  imageUrl: 'https://example.com/game.jpg',
  name: 'Input Limit Test',
  releaseDate: '2026-08-01',
  releaseLabel: 'August 1',
  targets: STEAM_BET_TARGETS.map((target) => ({
    ...target,
    averageValue: 200,
    predictionCount: 7_000_000,
    userValue: null,
  })),
};

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
});

describe('ForecastCard', () => {
  it('shows the average and volume beside each compact prediction input', () => {
    render(<ForecastCard game={game} isAuthenticated />);

    expect(screen.getAllByText('200 Avg.')).toHaveLength(3);
    expect(screen.getAllByText('7M Vol.')).toHaveLength(3);
    expect(screen.getByText('August 1').getAttribute('dateTime')).toBe('2026-08-01');
  });

  it('falls back to the Steam artwork resolver when a stored banner is missing', () => {
    render(<ForecastCard game={game} isAuthenticated />);

    const artwork = screen.getByRole('img', { name: 'Input Limit Test artwork' });
    fireEvent.error(artwork);

    expect(artwork.getAttribute('src')).toBe('/api/steam-artwork/42');
  });

  it('enforces the target-specific character limits while typing', () => {
    render(<ForecastCard game={game} isAuthenticated />);

    const ccu = screen.getByRole('textbox', {
      name: 'First weekend top CCU for Input Limit Test',
    }) as HTMLInputElement;
    const reviews = screen.getByRole('textbox', {
      name: 'First month total reviews for Input Limit Test',
    }) as HTMLInputElement;
    const price = screen.getByRole('textbox', {
      name: 'Full price in US for Input Limit Test',
    }) as HTMLInputElement;

    expect(ccu.maxLength).toBe(7);
    expect(reviews.maxLength).toBe(6);
    expect(price.maxLength).toBe(7);

    fireEvent.change(ccu, { target: { value: '123456789' } });
    fireEvent.change(reviews, { target: { value: '987654321' } });
    fireEvent.change(price, { target: { value: '123,4567' } });

    expect(ccu.value).toBe('1234567');
    expect(reviews.value).toBe('987654');
    expect(price.value).toBe('123.456');
  });

  it('submits the bounded draft instead of a lossy number-input value', () => {
    render(<ForecastCard game={game} isAuthenticated />);

    const ccu = screen.getByRole('textbox', {
      name: 'First weekend top CCU for Input Limit Test',
    });
    fireEvent.focus(ccu);
    fireEvent.change(ccu, { target: { value: '12345678' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Make bet' })[0]);

    expect(mocks.execute).toHaveBeenCalledWith({
      steamAppId: 42,
      targetKey: 'first_weekend_ccu',
      value: '1234567',
    });
  });
});
