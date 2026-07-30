import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Steam artwork resolver', () => {
  it('prefers the trusted Steam GameHero image from the store page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            1368140: {
              success: true,
              data: {
                header_image:
                  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1368140/hash/header.jpg',
                capsule_image:
                  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1368140/hash/capsule_231x87.jpg',
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const response = await GET(new Request('http://localhost/api/steam-artwork/1368140'), {
      params: Promise.resolve({ appId: '1368140' }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1368140/hash/header.jpg',
    );
  });

  it('rejects invalid app ids before contacting Steam', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://localhost/api/steam-artwork/nope'), {
      params: Promise.resolve({ appId: 'nope' }),
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the deployed Supabase resolver in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: {
          Location:
            'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1368140/hash/header.jpg',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://localhost/api/steam-artwork/1368140'), {
      params: Promise.resolve({ appId: '1368140' }),
    });

    expect(response.status).toBe(307);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://project.supabase.co/functions/v1/steam-artwork?appId=1368140',
    );
  });

  it('does not redirect to an untrusted image host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            42: {
              success: true,
              data: { header_image: 'https://example.com/not-steam.jpg' },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const response = await GET(new Request('http://localhost/api/steam-artwork/42'), {
      params: Promise.resolve({ appId: '42' }),
    });

    expect(response.status).toBe(404);
  });
});
