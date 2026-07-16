# Make horizontal paging interruptible

Priority: Medium, deferred
Baseline: `6eae70a`

## Problem

`HorizontalSwipePager` renders only the selected page. A committed swipe therefore animates the current page fully off-screen, swaps selection without animation, moves the new page to the opposite edge, and animates it in. During this 360 ms sequence, `isSettlingPage` rejects new gestures.

The direction is correct, but the transition is not interruptible and temporarily locks a frequent gesture.

## Why this is deferred

A correct fix is an API change, not a timing tweak. The pager needs to render neighboring content simultaneously so a gesture can directly control the transition fraction. Both plan-detail paging and workout paging own stateful page content, so the change needs focused regression testing in Simulator.

## Target architecture

- Change the builder from `content: () -> Content` to an indexed builder such as `content: (Int) -> Content`.
- Render previous/current/next pages in an HStack or layered stack.
- Bind the container offset directly to the live drag.
- On commit, update selection at the end of a single settle animation; on cancellation, return to zero.
- Allow a new drag to interrupt the in-flight animation from the presentation value.
- Preserve edge rubber-banding, predicted-end velocity, direction haptics, and Reduce Motion behavior.
- Avoid timers and `isSettlingPage` gesture lockout.

## Verification

- Rapidly swipe forward, then reverse before settlement finishes; the pager should follow the new gesture.
- Verify day-specific editor state is not duplicated or reset.
- Verify vertical scrolling still wins when vertical intent is stronger.
- Test first/last-page rubber-banding and Reduce Motion.
- Profile for redundant rendering if page content includes charts or large workout lists.
