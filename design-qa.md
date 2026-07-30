**Source visual truth**

- Header/loading reference: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-6ec75026-643a-403c-90db-fb6ec4b6986a.png` (1600 x 136 px).
- Card reference: `C:\Users\soinn\Downloads\Frame 489.png` (1446 x 209 px).
- Target state: desktop homepage with a thin top loading indicator, shorter search, 160 px page gutters, and collapsed game cards whose height is determined by an uncropped Steam capsule.

**Rendered implementation**

- URL: `http://127.0.0.1:3000/`.
- Screenshot: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-after-20260730.png`.
- Browser viewport and screenshot: 1920 x 1080 CSS/device pixels at density 1.
- State: guest, Popular upcoming, cards at rest after loading.

**Full-view comparison evidence**

- The reference images and rendered implementation were opened together in one comparison input.
- The page gutter is 160 px on both sides, 10 px tighter than the preceding implementation.
- Search width is 716.26 px versus 1173.77 px before the change, a 39% reduction after accounting for the wider content track.
- The disclosure arrow and expanded detail region are absent from both the DOM and the rendered cards.
- The navigation bar retains the existing NextHit Market typography, palette, tabs, and authentication actions.

**Focused card evidence**

- First card: 1267.73 x 168.26 px.
- Artwork box: 443.23 x 166.93 px, ratio 2.655.
- Loaded Steam asset: 231 x 87 px, ratio 2.655.
- The artwork uses `object-fit: contain`; the rendered slot and source ratios match, so there is no crop or stretch.
- Prediction field height is 99.33 px. The content no longer controls card height and therefore cannot stretch the artwork.

**Required fidelity surfaces**

- Fonts and typography: existing Inter scale and weights are unchanged; no new wrapping or truncation appeared.
- Spacing and layout rhythm: cards end exactly with the banner row; gutters and search width match the requested adjustments.
- Colors and tokens: the loading bar uses the existing `#1452f0` accent and is 2 px high like the reference.
- Image quality and asset fidelity: natural Steam capsule proportions are preserved; rounded corners come from the card mask.
- Copy and content: game names, release dates, prediction labels, tabs, and auth copy are unchanged.

**Interaction and runtime checks**

- Popular upcoming -> Trending navigation completed and the Trending tab became active.
- Progress component is configured for initial loads and client-side navigation with `startOnLoad`, 2 px height, 8% start position, and no spinner; covered by a component test.
- Page identity, meaningful DOM, missing framework overlay, and browser warning/error checks passed.
- Test suite: 19 files, 102 tests passed. TypeScript and lint passed.

**Comparison history**

1. P1: artwork was forced into the content-defined height with `object-fit: fill`. Fixed by making the 231/87 artwork aspect ratio define the row and switching to `contain`.
2. P2: the disclosure row added height and a redundant arrow. Fixed by removing the disclosure state, control, details markup, and associated CSS.
3. P2: 170 px gutters and the full-width search were wider than requested. Fixed to 160 px gutters and 60% search width.
4. P2: the installed progress bar did not start on initial load. Fixed by enabling `startOnLoad` and matching the 2 px accent treatment.
5. Post-fix browser evidence shows no remaining actionable P0/P1/P2 mismatch.

**Implementation checklist**

- [x] preserve Steam banner aspect ratio
- [x] card height follows banner height
- [x] remove disclosure arrow and expanded details
- [x] reduce page gutters by 10 px per side
- [x] shorten search by approximately 40%
- [x] enable thin top loading progress
- [x] verify desktop rendering, navigation, tests, types, and lint

final result: passed
