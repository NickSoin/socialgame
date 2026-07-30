# SteamBets Google OAuth design QA

## Source and implementation

- Source visual truth: `design-references/google-auth-reference.png` (840 × 843 px).
- Browser implementation: `design-references/google-oauth-sign-in-implementation.jpg` (1265 × 712 px).
- Normalized comparison: `design-references/google-auth-comparison.png`; both card regions are compared at 710 CSS px wide.
- Browser viewport: 1280 × 720 CSS px, DPR 1.5.
- State: signed-out `/login?next=/involved`, with Google OAuth entry visible.

## Full-view and focused comparison

- The full browser view confirms the SteamBets header, centered desktop card, and Google entry are visible without framework overlays.
- The focused side-by-side card comparison is required because typography, input geometry, border radii, and spacing are the fidelity-critical surfaces.
- The Google button is an intentional addition above the original email/password flow; the supplied Google mark is reused from the existing auth asset set.

## Fidelity review

| Surface | Result | Evidence |
| --- | --- | --- |
| Typography | Pass | Inter hierarchy, regular 50 px heading, bold labels, and button weights match the reference. |
| Spacing and layout | Pass | The 710 px card width, 56 px padding, 80 px inputs, and rounded frame reproduce the source rhythm. |
| Colors | Pass | `#FBFBFB` page, white card, neutral borders, and black primary action match the source. |
| Assets | Pass | Google uses the existing multicolor provider mark; no generated portrait or placeholder asset was added. |
| Copy | Pass | Existing sign-in copy is preserved; only `Continue with Google` and the `or` divider were added. |

## Interaction and runtime evidence

- `/login?next=/involved` renders the Google action above email/password.
- Clicking `Register` navigates to `/sign-up?next=%2Finvolved`; the same Google action is present and the destination is preserved.
- Component test verifies the Google action is invoked with `{ provider: 'google', next: '/involved' }`.
- Browser warning/error log: empty; Next.js overlay: absent.
- Web lint and typecheck pass; web tests 82/82 pass; database tests 103/103 pass; production build passes.
- End-to-end Google consent is pending production Google/Supabase credentials and is not represented as completed.

## Comparison history

- P2 found: the first implementation used a compact 430 px card and placed Google below the fold.
- Fix: restored the reference's 710 px geometry and moved Google above the email form so the requested path is visible in the first desktop viewport.
- Post-fix evidence: `design-references/google-auth-comparison.png`; no actionable P0/P1/P2 visual differences remain.

## Final result

final result: passed
