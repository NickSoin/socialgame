# NextHit Market visual QA

## Source and implementation

- Visual reference: Polymarket desktop navigation, cards, typography, and auth density as observed on 30 July 2026.
- Implementation: NextHit Market home, `/trending`, `/login`, and `/sign-up` at a 1280 × 720 desktop viewport.
- Product-specific game rows and numeric forecast controls remain intentionally distinct from Polymarket.

## Fidelity review

| Surface | Result | Evidence |
| --- | --- | --- |
| Typography | Pass | 24 px wordmark/page headings, 16 px body copy, and 14 px navigation/captions match the reference density. |
| Spacing and layout | Pass | 64 px header, 40 px search, compact cards, and 44 px auth fields keep all primary actions in the first desktop viewport. |
| Colors | Pass | `#FFFFFF` surfaces, `#F4F5F6` muted controls, `#E6E8EA` borders, `#0E0F11` text, and `#1452F0` actions reproduce the reference palette. |
| Branding | Pass | Visible product copy, metadata, tests, documentation, and social preview use NextHit Market. |
| Runtime | Pass | Unit tests, typecheck, production build, and browser navigation pass without application console errors. |

## Intentional differences

- NextHit Market uses horizontal Steam game rows and numeric forecast inputs instead of event probability cards.
- No Polymarket brand marks, proprietary assets, or copy are reused.
- Stable internal database and component identifiers retain their historical names to avoid breaking stored data and imports.

## Final result

Final result: passed.
