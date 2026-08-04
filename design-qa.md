**Source visual truth**

- Header/loading reference: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-6ec75026-643a-403c-90db-fb6ec4b6986a.png` (1600 x 136 px).
- GameHero/card reference: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-e35dcca4-b562-4930-9c11-b94ecd5df69a.png`.
- Target state: desktop homepage with a thin top loading indicator, shorter search, 160 px page gutters, and compact cards based on the uncropped 460 x 215 hero used on each game's Steam store page.

**Rendered implementation**

- URL: `http://127.0.0.1:3000/`.
- Screenshot: inspected in the in-app browser after a clean development build.
- Browser viewport and screenshot: 1920 x 1080 CSS/device pixels at density 1.
- State: guest, Popular upcoming, cards at rest after loading.

**Full-view comparison evidence**

- The reference images and rendered implementation were opened together in one comparison input.
- The page gutter is 160 px on both sides, 10 px tighter than the preceding implementation.
- Search width is 716.26 px versus 1173.77 px before the change, a 39% reduction after accounting for the wider content track.
- The disclosure arrow and expanded detail region are absent from both the DOM and the rendered cards.
- The navigation bar retains the existing NextHit Market typography, palette, tabs, and authentication actions.

**Focused card evidence**

- First card: 1141.19 x 183.02 px.
- Artwork box: 387.31 x 181.02 px, ratio 2.14.
- Loaded Steam asset: 460 x 215 px, ratio 2.14.
- The artwork uses `object-fit: contain`; the rendered slot and source ratios match, so there is no crop or stretch.
- Prediction inputs are 110 x 40 px. Field/input corner radii are 10/4 px, exactly twice their preceding values.
- The GameHero determines the card height at the 1920 px desktop target; its interior height differs from the card only by the card border.

**Required fidelity surfaces**

- Fonts and typography: existing Inter scale and weights are unchanged; no new wrapping or truncation appeared.
- Spacing and layout rhythm: cards end exactly with the banner row; gutters and search width match the requested adjustments.
- Colors and tokens: the loading bar uses the existing `#1452f0` accent and is 2 px high like the reference.
- Image quality and asset fidelity: natural Steam capsule proportions are preserved; rounded corners come from the card mask.
- Copy and content: the first market is `First weekend peak CCU`; the edit confirmation is `Approve`; names, release dates, tabs, and auth copy remain intact.

**Interaction and runtime checks**

- Popular upcoming -> Trending navigation completed and the Trending tab became active.
- Progress component is configured for initial loads and client-side navigation with `startOnLoad`, 2 px height, 8% start position, and no spinner; covered by a component test.
- Page identity, meaningful DOM, missing framework overlay, and browser warning/error checks passed.
- Test suite: 19 files, 105 tests passed. TypeScript, lint, and the Sites production build passed.

**Comparison history**

1. P1: artwork was forced into the content-defined height with `object-fit: fill`. Fixed by making the 231/87 artwork aspect ratio define the row and switching to `contain`.
2. P2: the disclosure row added height and a redundant arrow. Fixed by removing the disclosure state, control, details markup, and associated CSS.
3. P2: 170 px gutters and the full-width search were wider than requested. Fixed to 160 px gutters and 60% search width.
4. P2: the installed progress bar did not start on initial load. Fixed by enabling `startOnLoad` and matching the 2 px accent treatment.
5. The card switched from the 231 x 87 search capsule to Steam's 460 x 215 store-page GameHero, making the feed narrower and slightly taller without cropping.
6. Prediction inputs were reduced to 110 x 40 px, both radii were doubled, and the `Approve` action is positioned above the prediction-panel boundary instead of being clipped by the card.
7. Post-fix browser evidence shows no remaining actionable P0/P1/P2 mismatch.

**Implementation checklist**

- [x] resolve and preserve Steam GameHero aspect ratio
- [x] card height follows GameHero height at the target desktop viewport
- [x] remove disclosure arrow and expanded details
- [x] reduce page gutters by 10 px per side
- [x] shorten search by approximately 40%
- [x] enable thin top loading progress
- [x] compact prediction inputs and double their radii
- [x] rename the confirmation to Approve and the first market to peak CCU
- [x] verify desktop rendering, navigation, tests, types, and lint

## Wishlist ranks, Steam Popular Upcoming, and shared search images

- References: `codex-clipboard-62438871-fe3d-4b8d-bed4-6b2dad8a66b5.png` and `codex-clipboard-1b15dc35-3a70-42c5-b235-49f83b370fee.png`.
- Viewport: desktop, 1600 x 900.
- Wishlist badge: bottom-left overlay, dark navy fill, cyan border, compact white rank text. The first five visible ranks match the supplied reference: `#77`, `#40`, `#278`, `#122`, `#35`.
- Popular Upcoming: the first five rendered games match Steam's live `popularcomingsoon` order: Corsair Cove, Beast of Reincarnation, The Relic: First Guardian, MARVEL Tōkon: Fighting Souls, and IRON NEST: Heavy Turret Simulator.
- Image consistency: feed cards and search results both render the shared GameHero component through the same Steam header-image resolver. The eight inspected feed images and eight inspected search images all loaded at 460 x 215 with no broken images.
- Search: the `gu` query returns eight dynamic catalog matches with artwork and wishlist ranks. Selecting Guild Wars 3™ navigates to its filtered card and preserves the same GameHero and rank.
- Automated checks: 107 tests passed, TypeScript passed, lint passed, the local Edge Function returned 200 Steam rows, and the Sites production build completed.

## Card hover and Popular Upcoming ordering

- Hover reference: the live Polymarket desktop market grid. The interaction is a restrained 2 px vertical lift with a slightly stronger shadow and border, using a 160 ms ease transition.
- The hover treatment runs only on precise hover-capable pointers. Reduced-motion users receive the static card state.
- Popular Upcoming is sorted after TopWishlisted ranks have been hydrated: release date ascending first, wishlist rank ascending within the same release day, with unranked games after ranked games and unknown dates last.
- The sorter is immutable and has focused tests for cross-day order, same-day rank order, missing ranks, and TBA dates.

final result: passed

# Forecast card redesign — visual QA

## Source visuals

- Forecast tile states: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-2a01b479-8aef-4023-b893-62db05fac12c.png`
- Collapsed and expanded game cards: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-e1cc08b0-4539-4f25-862b-cf253018f791.png`

## Rendered evidence

- Desktop collapsed: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-desktop-collapsed-final.png`
- Desktop expanded: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-desktop-expanded-final.png`
- Forecast editor: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-forecast-editor-final.png`
- Locked state: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-locked-final.png`
- Reference comparison: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-reference-comparison.png`

## Target and state

- Viewport: 1659 × 900 CSS pixels at device pixel ratio 1.5.
- Data: Akatori with realistic wishlist rank, follower count, four forecast markets, averages, history, and a saved forecast.
- States exercised: saved, empty, editing, collapsed, expanded, and locked.

## QA history

1. The first render exposed stale development CSS and overflowing tile controls. A clean build plus card-width container rules restored the intended two-column tile layout without overflow.
2. Recharts initially produced non-deterministic server/client clip identifiers. The chart now mounts after hydration and uses a stable line identifier; a fresh browser tab reports no errors or warnings.
3. The expand control's painted hit area was too narrow at the card edge. Its hit target was moved inside the card and verified through actual browser interaction.
4. The expanded panel was verified as a three-column grid. The two current secondary markets occupy the first two columns, leaving the third ready for future markets; the first tile is inset from the card edge.
5. Source and rendered screenshots were combined into one comparison image. Typography, border weight, radii, graph treatment, state colours, market ordering, and expansion hierarchy match the supplied direction within the existing site shell.

## Final result

passed

# Two-column expansion and release-lock synchronization — visual QA

## Source visual truth

- User-reported collapsed state: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-2b43b8ad-aa25-4c74-b70a-76c968745ea5.png` (978 × 173 px).
- Requested corrections: keep the disclosure arrow fully inside the card; start the expanded surface exactly at the GameHero right edge; use two aligned forecast columns; never show Locked while the game lifecycle is upcoming.

## Rendered implementation

- URL: `http://localhost:3000/` in the Codex in-app browser.
- Expanded screenshot: `C:\Users\soinn\AppData\Local\Temp\forecast-card-final-expanded-clean.png` (1265 × 712 px).
- Source/implementation comparison: `C:\Users\soinn\AppData\Local\Temp\forecast-card-two-column-comparison.png` (1265 × 1025 px).
- Viewport: 1280 × 720 CSS px with a 1265 px document client width after the scrollbar; screenshot density is 1 exported pixel per CSS pixel.
- State: authenticated Popular upcoming feed, Akatori, all four markets forecastable, expanded panel visible.

## Full-view and focused comparison evidence

- The supplied screenshot and final implementation were placed together in the combined comparison image before the final judgment.
- The expanded panel's measured left edge equals the GameHero's measured right edge exactly (`leftDelta = 0`).
- The expanded surface contains exactly two forecast tiles and no placeholder column.
- Expanded-column x positions differ from their corresponding primary-column positions by only 0 px and 1 px; widths differ by 1 px because the expanded surface owns its border.
- The disclosure SVG is fully contained inside the top card surface, so the card edge no longer clips it.
- The live upcoming card exposes zero Locked controls and four Forecast controls after expansion.
- At the intermediate desktop viewport the leaderboard now moves below the feed, preserving full forecast controls instead of clipping the right column.

## Release-lock lifecycle evidence

- `steam_games.lifecycle_status` is the single release signal for feed placement and forecast locking.
- A stale market-level `locked` value is ignored by the upcoming-card UI and reopened by the submission path.
- The scheduled lock cycle no longer locks on an estimated timestamp while Steam still reports the game as upcoming.
- The confirmed `upcoming → released` transition closes every market atomically; already resolved markets remain resolved, while open markets become locked.
- Released games continue to be selected by the Locked feed and every rendered forecast control becomes Locked.

## Comparison history

1. P1: the disclosure icon crossed the lower card edge. Removed the vertical translation and reserved bottom space; measured SVG containment now passes.
2. P1: the expanded surface used a third track beneath the image. Reduced it to two tracks and aligned its border to the GameHero edge.
3. P1: estimated release time could lock a still-upcoming game. Replaced timestamp-only locking with confirmed lifecycle locking across trigger, cycle, snapshot, submission, and UI paths.
4. P2: the leaderboard squeezed forecast controls at intermediate desktop widths. Moved it below the feed at widths up to 1360 px.
5. Post-fix browser evidence confirms exact panel alignment, two columns, a visible arrow, four forecastable upcoming markets, and no console error overlay.

## Automated verification

- Database pgTap: 197 passed.
- Vitest: 179 passed, 2 skipped.
- TypeScript: passed.
- oxlint: 0 warnings, 0 errors.
- Declarative-schema diff: no changes found after applying the generated migration locally.

final result: passed

# Forecast tile composition polish — final visual QA

## Source visual truth

- Expanded card reference: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-cbdd89dd-ec9a-4500-a652-1a13d327d4e7.png` (1660 × 757 px).
- Forecast tile reference: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-a00d5fa6-bc08-431b-9381-be6a0bb57638.png` (1042 × 883 px).
- User-reported render: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-f7853935-3783-40fb-801e-b799050b4447.png` (978 × 304 px), with focused tile crop `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-11c7b492-c24e-4e18-967a-9df03d9394e2.png` (292 × 94 px).

## Rendered implementation

- URL: `http://localhost:3000/` in the Codex in-app browser.
- Collapsed screenshot: `C:\Users\soinn\AppData\Local\Temp\forecast-card-final-collapsed.png` (1280 × 720 px).
- Expanded screenshot: `C:\Users\soinn\AppData\Local\Temp\forecast-card-final-expanded-clean.png` (1280 × 720 px).
- Focused card crop: `C:\Users\soinn\AppData\Local\Temp\forecast-card-final-expanded-crop.png` (896 × 246 px).
- Normalized source/implementation comparison: `C:\Users\soinn\AppData\Local\Temp\forecast-card-final-design-comparison.png` (1812 × 246 px).
- Viewport: 1280 × 720 CSS px at density 1; the implementation card is 896 × 245.5 CSS px. The reference card was normalized to the same 896 px width before comparison.
- State: authenticated Popular upcoming feed, Akatori, four markets, collapsed and expanded; forecast editor opened and cancelled.

## Full-view and focused comparison evidence

- The normalized source card and final implementation crop were placed in the same comparison input before the final judgment.
- Compact tiles are 273.35–273.36 × 76 px. Primary columns begin at x=363.27 and x=646.64; expanded columns two and three begin at those exact same x coordinates. The intentionally inset expanded first column begins at x=79.92.
- Every market title fits without truncation: each title's `clientWidth` equals its `scrollWidth`, including `First month total reviews`.
- Title, execution time, average, and Forecast control all resolve to the same 12.2204 px font size. Forecast-count metadata remains smaller.
- The tag row ends at y=186.17 and the primary tiles start at y=194.17, preserving an 8 px clear gap.
- Chart and statistics share the same optical center: the chart container and stats center at y=241.17, while the painted chart path is within 1 px at y=242.17.
- The expanded panel uses 10 px top and 12 px bottom compact padding; the final card is within 7 px of the height-normalized reference.

## Required fidelity surfaces

- Fonts and typography: one container-responsive token controls all main tile text; labels are complete, weights preserve the reference hierarchy, and singular `1 forecast` grammar is correct.
- Spacing and layout rhythm: compact tile height is 76 px; primary and expanded tracks share exact column lines; the lower row is tightly grouped without colliding with the disclosure control.
- Colors and tokens: green chart, blue Forecast, yellow saved state, neutral Locked state, muted date/count, pale borders, and white surfaces preserve the selected direction.
- Image quality and asset fidelity: the live Steam GameHero remains the source asset with its production crop; no synthetic replacement was introduced.
- Copy and content: all four market labels, dates, averages, counts, Forecast, saved, and Locked states remain available.
- Interaction and accessibility: Forecast entered editing and cancelled successfully; collapse and a second expand both succeeded; focus styling remains visible for keyboard users.

## Comparison history

1. P1: full market names were clipped at the reported compact width. Replaced the fixed compact size with a card-container-responsive 12–14 px token, tightened the header gap, and measured every title with no overflow.
2. P2: an empty market showed both `No average yet` and an em dash. Replaced the duplicate copy with one neutral chart baseline plus the single numeric empty marker.
3. P2: a one-value chart was pinned to the chart edge. Added a padded local domain so a flat consensus line is vertically centered.
4. P2: compact tiles and the expanded-panel gap were vertically loose relative to the reference. Reduced compact tiles to 76 px and the panel padding to 10/12 px.
5. P2: desktop gutters and the fixed leaderboard track squeezed the feed around the reference width. Reduced shell gutters at ≤1360 px and moved the leaderboard below the feed at ≤1080 px.
6. Post-fix browser evidence: meaningful DOM rendered, no framework overlay, no console errors or warnings, exact column alignment, complete labels, editor interaction, and repeatable collapse/expand all passed.

## Automated verification

- Vitest: 178 passed, 2 skipped.
- TypeScript: passed.
- oxlint: 0 warnings, 0 errors.

final result: passed

# Forecast card layout correction — visual QA

## Source visual truth

- Expanded game-card reference: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-cbdd89dd-ec9a-4500-a652-1a13d327d4e7.png` (1660 × 757 px).
- Forecast-tile state reference: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-a00d5fa6-bc08-431b-9381-be6a0bb57638.png` (1042 × 883 px).
- Reported broken render: `C:\Users\soinn\AppData\Local\Temp\codex-clipboard-bd0ce543-47d9-4ba1-a3da-ec7bb551eb7f.png`.

## Rendered implementation

- URL: `http://localhost:3000/`.
- Desktop collapsed: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-layout-fix-collapsed-final.png` (1659 × 900 px).
- Desktop expanded: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-layout-fix-expanded-final.png` (1659 × 900 px).
- Combined comparison: `C:\Users\soinn\AppData\Local\Temp\nexthit-card-layout-reference-comparison.png`.
- Viewport: 1659 × 900 CSS px; screenshots export at 1659 × 900 px, so comparison density is normalized to 1 exported pixel per CSS pixel.
- State: authenticated Popular upcoming feed, Akatori, one saved primary forecast, one empty primary forecast, expanded and collapsed.

## Full-view and focused comparison evidence

- Source and implementation were placed together in the combined comparison image before judging the result.
- The two primary tiles remain beside the GameHero, while the expanded row uses three equal-width tracks.
- Measured primary columns start at x=536.65 and x=859.99. Expanded columns two and three start at the same x=536.65 and x=859.99; all five visible/placeholder tracks are 311.33–311.34 px wide.
- The lower first tile starts at x=213.31, preserving the reference's intentional inset from the card edge.
- The tag row ends at y=186.17 and the primary tiles begin at y=192.17, leaving a 6 px clear gap with no overlap.
- Tile title, execution time, average value, and Forecast/saved control all resolve to the same 14 px font size at this card width. Forecast-count metadata remains 10 px.
- The chart line spans y=232.36–258.34 and the average value spans y=232.42–246.42, placing the graph and number on the same horizontal band.

## Required fidelity surfaces

- Fonts and typography: main tile copy now shares one responsive font-size token; weights and muted forecast-count hierarchy remain faithful to the reference.
- Spacing and layout rhythm: fixed header rows were removed, tile height scales down to 86 px at the compact desktop card width, and the expanded grid shares the primary column lines.
- Colors and tokens: white surfaces, pale-grey borders, green chart line, blue Forecast state, yellow saved state, and muted timestamps are unchanged from the selected direction.
- Image quality and asset fidelity: the existing Steam GameHero remains uncropped and no replacement or synthetic imagery was introduced.
- Copy and content: all four market names, dates, averages, counts, saved value, Forecast, and Locked behavior remain intact.
- Icons and interaction states: the existing Heroicons disclosure control remains keyboard focusable; expand and collapse were both exercised successfully.

## Comparison history

1. P1: fixed-height game header let forecast tiles collide with the tag row. Replaced the fixed tracks with content-sized rows and verified a 6 px rendered gap.
2. P1: primary and expanded tiles used independent grids, so their central vertical lines differed. Rebuilt the expanded panel from the primary card variables; measured column starts now match exactly.
3. P2: title, date, average, and button used four different responsive font sizes. Consolidated them under one responsive token and measured all four at 14 px in the compact desktop state.
4. P2: graph, average, and control were bottom-aligned at different optical heights. Center-aligned the row and made the chart follow its rendered container height.
5. P2: compact desktop tiles retained the 120 px large-card height and looked vertically stretched. Reduced the compact state to 86 px while preserving the 134 px large-card and 118 px mobile treatments.
6. Post-fix browser evidence shows no framework overlay, no console errors or warnings, exact desktop column alignment, and working expand/collapse interaction.

## Responsive note

- The selected visual target is desktop. A 390 px smoke check confirmed the card still renders, but the wider application shell retains its pre-existing desktop minimum width; that shell-level mobile behavior was not changed in this component correction.

## Final result

passed
