# Animation improvement plans

Audit baseline: `6eae70a`

These plans were produced from a frequency-first motion audit. The order reflects user impact, not visual novelty: motion that happens while typing or repeatedly logging a workout receives more scrutiny than rare celebrations.

| Priority | Plan | Decision | Reason |
| --- | --- | --- | --- |
| 1 | [Stop animating live search results](001-stop-animating-live-search-results.md) | Implement now | Broad layout springs run on every result-count update while the user types. |
| 2 | [Narrow repeated numeric motion](002-narrow-repeated-numeric-motion.md) | Implement now | Repeating steppers animate their entire container even though the number already has a purpose-built transition. |
| 3 | [Refine workout set feedback](003-refine-workout-set-feedback.md) | Implement now | Logging is the core repeated action; its state change should be legible, quick, and non-bouncy. |
| 4 | [Complete swipe-to-archive motion](004-complete-swipe-to-archive-motion.md) | Implement now | The gesture tracks the finger, but the card currently disappears without completing its path. |
| 5 | [Make horizontal paging interruptible](005-make-horizontal-paging-interruptible.md) | Defer | Valuable, but it requires changing the pager API to render neighboring pages and carries higher state/layout risk. |

## Motion vocabulary used

- **Press/tap feedback:** immediate response while a control is held.
- **Numeric ticker:** a content transition limited to the changing number.
- **Continuity transition:** old and new state share the same visual location instead of popping.
- **Contextual icon replacement:** a state symbol replaces another symbol in place.
- **Drag tracking:** content follows the finger 1:1 while the gesture is active.
- **Rubber-banding:** resistance at an invalid boundary.
- **Direction-aware transition:** entry and exit preserve navigation direction.
- **Interruptible animation:** a new gesture can take control before the prior animation finishes.

## Explicit non-goals

- No chart line-drawing or decorative graph entrances; data readability wins.
- No tab or screen entrance stagger; those routes are high-frequency and should feel immediate.
- No added animation to workout-complete or achievement celebrations. They already spend the app's rare-delight budget and include Reduce Motion handling.
- No extra bounce on steppers. Frequent controls should be calm under repetition.
