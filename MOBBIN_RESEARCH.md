# Workout UX Reference Notes

Research date: June 22, 2026

Goal: Use shipped mobile workout patterns to guide Scratch toward fast plan creation, one-handed workout logging, and clear completion feedback while keeping the current dark sports visual system.

## References And Takeaways

### Progressive plan setup

References:
- Tempo starting a training plan: https://mobbin.com/flows/985e6fd9-9777-4644-8e79-05c8c75d1b20
- Equinox+ personalizing a program: https://mobbin.com/flows/754cee5d-c1f4-44a7-9ae9-5e09474db3a3
- Runna onboarding: https://mobbin.com/flows/1689d6d5-e245-4369-9dae-320bd863136b
- 5 Minute Journal onboarding: https://mobbin.com/flows/dce031a1-1a4b-40e7-8474-3413989ddc21

What works:
- Setup flows feel less intimidating when each screen has one job.
- Strong title-led screens and persistent bottom actions keep the user oriented.
- Progress indicators make longer setup feel bounded.
- Fitness setup flows often split schedule, preferences, exercise selection, and confirmation instead of showing one long editor.
- Review moments help users feel ownership before committing to a plan.

Scratch adaptation:
- Keep plan creation progressive: frequency, exercise search, configuration, review, and activation.
- Use the current bold title style and bottom CTA language.
- Keep exercise entry searchable and quick, with configuration one exercise at a time.
- Make the final review feel like a training plan the user can activate immediately.

### Hevy

References:
- Creating a routine flow: https://mobbin.com/flows/49e3ad2c-6e8a-4f75-8a1a-96010829280f
- Edit routine flow: https://mobbin.com/flows/bbe43bcd-bbd3-4fd7-a0ac-75ee1cd248ad
- Set logging screen: https://mobbin.com/screens/3c0f68f3-69ee-4892-bce4-3939fcce734e
- Workout screen: https://mobbin.com/screens/5051937b-36e0-432a-9ca9-2cf3be8789c3

What works:
- Routine creation is practical and list-first.
- Exercise blocks and set prescriptions are easy to scan.
- Set tables make reps, weight, previous values, and completion state visible at once.

Scratch adaptation:
- Keep Plans as a first-class tab area.
- Preserve compact set-table logic during logging.
- Make the active exercise and Log action more prominent than secondary workout metadata.

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

Scratch adaptation:
- Continue moving exercise by exercise in the active workout flow.
- Keep weight and rep controls large and close to the Log CTA.
- Add richer progress later only when it directly helps the next workout decision.

### Ladder

References:
- Workout plan screen: https://mobbin.com/screens/358aff92-c42b-459f-bd80-79b551c7987a
- Workout detail: https://mobbin.com/screens/a7eb179c-af47-46e5-b66f-5dee44ffaa94
- Completion screen: https://mobbin.com/screens/3a9eda02-3ea8-48fd-9458-73ee3677b059

What works:
- Workout days feel approachable and guided.
- Plan cards have clear hierarchy and are less spreadsheet-like.
- Completion gives closure without requiring analysis.

Scratch adaptation:
- Saved plans should feel owned and reusable.
- Start Workout should confirm the day and exercise list before logging begins.
- Completion should stay compact: celebration, stats, and a clear finish action.

### Nike Training Club

References:
- Workout detail: https://mobbin.com/screens/15da49ae-502b-4055-9f79-3943cbc9be25
- Save workout flow: https://mobbin.com/flows/cdfee234-0f20-4a4d-98b9-059dbd93812c

What works:
- Strong workout identity and a clear primary action.
- The plan feels memorable instead of purely tabular.

Scratch adaptation:
- Use the dark sports styling to make workout days feel distinct.
- Avoid content-feed behavior; the primary action should stay tied to planning or logging.

### Strava

Reference:
- Saved activity screen: https://mobbin.com/screens/c48cd10d-e494-40f7-a078-76db428da2e6

What works:
- Activity summaries create a sense of accomplishment with stats and closure.

Scratch adaptation:
- Workout completion should give a satisfying finish without becoming social or noisy.
- Keep stats concrete: duration, exercises, sets, and later volume or records when available.

## Design Decisions

- Plans are a core navigation area.
- Logging is an active, exercise-specific flow.
- Completion is a short reward and summary, not a dashboard.
- The app stays dark, high-contrast, and athletic.
- New references should be filtered through the existing Scratch Figma direction before implementation.
