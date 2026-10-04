# Onboarding Review Synthesis

Three independent reviews evaluated the five concepts through growth/behavioral integrity, Scratch product fit, and visual UX/accessibility.

## Review outcome

| Variant | Growth review | Scratch product review | Visual UX review | Synthesis |
| --- | ---: | ---: | ---: | --- |
| A — First Set | 22/25 | 21/25 | 29/30 | Best first prototype; clearest path to the product's core action. |
| B — Built For Your Week | 17/25 | 20/25 | 23/30 | Best plan-first challenger; recommendation integrity is the main risk. |
| C — Set Your Rhythm | 19/25 | 15/25 | 24/30 | Strong behavioral concept, but current data and notification infrastructure cannot fulfill the promise. |
| D — Confidence Builder | 18/25 | 17/25 | 21/30 | Useful novice reassurance, but too much unimplemented coaching UI; fold its best copy into A. |
| E — Meet Me Where I Am | 23/25 | 18/25 | 23/30 | Best universal router and experiment shell; not the strongest core experience by itself. |

## Recommended experiment architecture

Use **E as a one-tap router**, with no preselection and no separate Continue button:

- `I have a plan` → existing plan composer.
- `Build one for me` → B, shortened to four questions that materially change the plan.
- `Just let me train` → A, using a real starter workout rather than an unsupported empty-workout route.

If the first implementation must be one linear onboarding rather than a router, prototype **A and B as opposing experiments**:

- A minimizes time to the first core action.
- B maximizes confidence in a reusable active plan.

Both must converge on the same real contract: activated `WorkoutPlan` → Home showing the plan → Start Workout → first persisted set.

## Required corrections before implementation

### Across every screen

- Replace ImageGen's vignette, glow, and smoky texture with the app's flat `#0D0D0D` background.
- Use the real 32 pt display token and existing screen-title geometry unless a new onboarding title token is deliberately introduced.
- Restore the centered 312×56 primary CTA instead of the near-full 354 pt rail.
- Standardize progress on one Scratch-native component rather than five invented styles.
- Give every back, edit, skip, and text action a minimum 44×44 pt hit area.
- Do not rely on neon green alone for selection; add a check, label, or selected trait.
- Verify Dynamic Type, VoiceOver order, and secondary-text contrast in implementation.

### Variant A

- Resolve the sandbox contradiction: either `Try logging a set` + `Complete demo set`, or persist a real `Log your first set` action.
- Remove the intimidating `60 kg` novice default. Prefer `Bodyweight`, an empty value, or an explicit `Demo values` label.
- Use the actual workout logger controls, not oversized invented steppers.
- Ensure demo completion cannot change history, personal bests, achievements, or cloud state.

### Variant B

- Reduce the visible six-step setup to four high-information questions.
- Show the answers that produced the recommendation and let users edit them.
- Do not present weekdays or duration as persisted facts until the model supports them.
- Make the primary action behavioral: `Start Upper` or `Review & start`, not activation-only.

### Variant C

- Do not ship until weekday/time/place, reminders, backup workouts, and notification timing exist in the product model.
- When infrastructure exists, offer this after motivation or plan selection, not as universal first-launch administration.

### Variant D

- Remove the unimplemented rest timer/RPE teaching and glowing success treatment.
- Preserve only the demonstrated-action reinforcement: `That's one set logged. Next time, you'll use the same two controls.`

### Variant E

- Make every route row navigate immediately.
- Remove duplicate escapes and keep one `Explore without setup` action.
- Do not preselect `Build one for me`; if marked, use `Best if you want guidance` rather than generic `Recommended`.
- Replace the unsupported empty-workout promise with a starter plan unless ad-hoc workouts are added.

## Measurement plan

Primary metric: first real workout or persisted set within 72 hours.

Secondary metrics: time to first set, plan activation, first-week workout count, D7 return, and week-four consistency.

Guardrails: onboarding abandonment, branch backtracking, plan edit/substitution rate, demo-data confusion, notification denial, and account/paywall exits.

Track sandbox and real actions separately. A demo-set event must never count as product activation.
