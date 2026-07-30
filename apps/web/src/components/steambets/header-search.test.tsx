import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HeaderSearch, type HeaderSearchGame } from './header-search';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  mocks.push.mockReset();
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

const games: HeaderSearchGame[] = [
  {
    appId: 1,
    imageUrl: 'https://example.com/corsair.jpg',
    name: 'Corsair Cove',
    releaseLabel: 'July 31',
  },
  {
    appId: 2,
    imageUrl: 'https://example.com/beast.jpg',
    name: 'Beast of Reincarnation',
    releaseLabel: 'August 3',
  },
];

describe('HeaderSearch', () => {
  it('shows matching games as the user types and navigates on selection', () => {
    render(<HeaderSearch games={games} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Search games' }), {
      target: { value: 'cors' },
    });

    expect(screen.getByText('Corsair Cove')).toBeTruthy();
    expect(screen.queryByText('Beast of Reincarnation')).toBeNull();

    fireEvent.click(screen.getByText('Corsair Cove'));
    expect(mocks.push).toHaveBeenCalledWith('/?q=Corsair+Cove');
  });

  it('shows an empty state when no games match', () => {
    render(<HeaderSearch games={games} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Search games' }), {
      target: { value: 'nothing' },
    });
    expect(screen.getByText('No matching games')).toBeTruthy();
  });
});
