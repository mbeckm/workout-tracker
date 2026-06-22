# Mobbin Reference Notes

Research date: June 22, 2026

Goal: Find shipped mobile UX patterns for a light-first iOS workout tracker focused on reusable workout plans, one-handed set logging, and clear strength progress.

## References And Takeaways

### Hevy

References:
- Creating a routine flow: https://mobbin.com/flows/49e3ad2c-6e8a-4f75-8a1a-96010829280f
- Edit routine flow: https://mobbin.com/flows/bbe43bcd-bbd3-4fd7-a0ac-75ee1cd248ad
- Set logging screen: https://mobbin.com/screens/3c0f68f3-69ee-4892-bce4-3939fcce734e
- Workout screen: https://mobbin.com/screens/5051937b-36e0-432a-9ca9-2cf3be8789c3

What works:
- Routine creation is list-first and practical.
- Exercise blocks and set prescriptions are easy to scan.
- Set tables make reps, weight, previous values, and completion state visible at once.

Kinetic adaptation:
- Make Plans a first-class area, not a secondary utility.
- Keep plan editing direct: plan name, exercise groups, set targets, quick add, duplicate, reorder.
- Use compact table logic for logging, but make the current set friendlier and more thumb-first.

### Fitbod

References:
- Logging a set flow: https://mobbin.com/flows/b1360b0b-ed52-47ff-8ba6-30f53dbeed92
- Logging screen: https://mobbin.com/screens/253d6da9-a4af-4e03-b74a-3662133cbcd9
- Progress and achievements flow: https://mobbin.com/flows/0370a20a-883d-422c-ac29-ab1aa8de71ec
- History and progress screen: https://mobbin.com/screens/0475f18a-084c-4a7a-85c6-7e5c15b98b9f

What works:
- Set entry is exercise-specific, which reduces ambiguity.
- Progress is framed as concrete milestones and exercise history.
- Charts support a clear story instead of becoming generic analytics.

Kinetic adaptation:
- Tap-to-edit reps and weight with steppers or a keypad sheet.
- Auto-advance after saving a set, with a short confirmation state.
- Show last performance, best set, estimated strength trend, volume trend, and recent sessions per exercise.

### Ladder

References:
- Workout plan screen: https://mobbin.com/screens/358aff92-c42b-459f-bd80-79b551c7987a
- Workout detail: https://mobbin.com/screens/a7eb179c-af47-46e5-b66f-5dee44ffaa94
- Completion screen: https://mobbin.com/screens/3a9eda02-3ea8-48fd-9458-73ee3677b059

What works:
- Workout days feel approachable and guided.
- Plan cards have clear hierarchy and are less spreadsheet-like.
- Completion gives closure without requiring analysis.

Kinetic adaptation:
- Saved plans should feel owned and reusable: plan title, day label, exercise count, estimated duration, recent best.
- Keep advanced editing one level deeper.
- Use light cards and friendly hierarchy around plans.

### Nike Training Club

References:
- Workout detail: https://mobbin.com/screens/15da49ae-502b-4055-9f79-3943cbc9be25
- Save workout flow: https://mobbin.com/flows/cdfee234-0f20-4a4d-98b9-059dbd93812c

What works:
- Strong workout identity and a clear primary action.
- The plan feels memorable instead of purely tabular.

Kinetic adaptation:
- Use visual hierarchy to make a plan feel like a reusable object.
- Avoid full hero imagery; Kinetic should stay tool-like and light.
- Primary action should be "Log set" or "Open logger", not a heavy start-workout ceremony.

### Strava

Reference:
- Saved activity screen: https://mobbin.com/screens/c48cd10d-e494-40f7-a078-76db428da2e6

What works:
- Activity summaries create a sense of accomplishment with stats and closure.

Kinetic adaptation:
- After logging, show small celebration and concrete stats: set saved, volume added, PR if relevant.
- Keep it private and utility-first, not social-first.

## Design Decisions

- Plans are the home base.
- Logging is a compact set table plus a thumb-first active row.
- Progress answers one question: "Am I getting stronger?"
- Delight is small and immediate: saved-set pulse, PR badge, encouraging microcopy, and satisfying progress deltas.
- Keep the UI light-first, calm, and compact. Use Volt only for active/save/progress emphasis.
