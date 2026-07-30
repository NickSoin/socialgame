import { describe, expect, it } from 'vitest';
import { parseSteamPopularUpcoming } from './parse-steam-popular-upcoming';

const STEAM_RESULTS_HTML = `
  <a href="https://store.steampowered.com/app/4739040/" class="search_result_row" data-ds-appid="4739040">
    <div class="search_capsule"><img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4739040/capsule_231x87.jpg"></div>
    <span class="title">DISCIPLINE &amp; SIMULATOR</span>
    <div class="search_released responsive_secondrow">Jul 30, 2026</div>
  </a>
`;

describe('parseSteamPopularUpcoming', () => {
  it('maps the official Steam search row into a game card', () => {
    const [game] = parseSteamPopularUpcoming(STEAM_RESULTS_HTML);

    expect(game).toMatchObject({
      appId: 4_739_040,
      name: 'DISCIPLINE & SIMULATOR',
      releaseLabel: 'July 30',
      imageUrl: expect.stringContaining('/4739040/'),
    });
    expect(game?.targets.map((target) => target.key)).toEqual([
      'first_weekend_ccu',
      'first_month_reviews',
      'full_price_us',
    ]);
  });

  it('skips incomplete rows instead of rendering broken cards', () => {
    expect(parseSteamPopularUpcoming('<a href="/" data-ds-appid="1"></a>')).toEqual([]);
  });
});
