# Product decisions to review

Picked while porting Family loop into `mobile/`. Trim is usable; these are the calls to walk one by one. Re-checked against `mobile/src` on 2026-09-24.

1. **Log Cancel.** Paper only shows Finish. The app keeps a tertiary **Cancel** on the left so a mid-workout abort is possible without Finish → empty-sets alert. Finish still confirms discard if nothing was logged.

2. **Keyboard docking.** The log footer follows `react-native-keyboard-controller` so wells and Log set ride the system keyboard. The hero stays pinned. Native stack `keyboardHandlingEnabled` is off on Log, New plan, and Prescribe so the whole screen does not jump.

3. **Paywall prices.** Prices come only from StoreKit through the RevenueCat offering (placement = gate reason, else the current offering); nothing is hardcoded. Paper's `$49.99 a year` / `Monthly $5.99` is superseded: 1.0 sells $39.99/yr with a 7-day free trial (annual only) and $6.99/mo, set in App Store Connect. Options render only for packages the offering has (yearly, monthly, and lifetime only if added). While loading, the CTA reads "Loading prices…"; if loading fails it reads "Try again". The CTA says "Start free trial" when the selected yearly plan has an eligible trial, otherwise "Subscribe" ("Buy lifetime" for lifetime). Tapping an option selects it. Auto-renewal terms sit above the CTA; Restore · Terms of Use · Privacy Policy sit in the footer. "Not now" sits top right, always visible. Layout (Sep 2026): one headline with no subheading, benefit rows with an SF Symbol tile, then plan options and the trial timeline, all above the fold on a 6.3" iPhone.

4. **Prescribe edit.** Paper is a read-looking `4 × 8` list. Tap a row to dock SETS / REPS wells (same language as the log) above the keyboard. Values update as you type; empty is allowed until blur, then it clamps to 1–99. Remove is a red caption under the wells.

5. **Add day.** **Add day** appends an empty `Day n` to the plan. Opening an empty day goes straight to the exercise picker, which then lands on the day editor (PE-1). Day rows have a context menu: Rename, Duplicate, Move up / down, Remove.

6. **Home / day preview rows.** Read-only (DP-1): each row shows the exercise name and its prescription, and the sheet's one job is Start (or Resume). The exercise sheet route no longer opens from anywhere; it only held media, and 1.0 ships none.

7. **Log strip.** Tap another chip to jump; swipe the stage left or right to move between exercises. Tap the large name for the Exercise sheet (plan, Last time, Best, then Alternatives). Tap the selected chip, or long-press any chip or the name, for the Day sheet. The Day sheet caption says "Drag to reorder": drag a row to move it, tap a row to jump. VoiceOver gets "Show the day" as an action.

8. **In-session swap.** Replaces that slot on the plan and in the current log. Logged sets on that exercise are kept; if none are logged, sets rebuild from the new exercise.

9. **Rest.** Logging a set starts rest, except after the last set of the workout. `Rest` and the clock sit above the wells, with quiet −15 / +15 / Skip on the baseline; tapping the clock also skips. At 0:00 there is one success haptic and the label reads `Go` for two seconds, then rest disappears. Rest keeps running when auto-advance moves to the next exercise, and the Live Activity mirrors the workout on the Lock Screen.

10. **Finished exercise.** When every set is logged, the CTA becomes **Next exercise** (or **Finish workout** when nothing is left), and Last time summarizes the whole last session. Logged sets stay listed above the wells; tapping a well or a set edits that set (**Update set** / Cancel).

11. **Last time.** A single quiet line under `Set n of m`: `Last time 72.5 × 8`, taken from the same set position in the last session (or its last set when this session has more). It stays visible all session; it no longer hides after the first logged set. Units never ride along. The "Previous" residue label is gone. Next-session targets (Pro) will share this caption slot.

12. **History delete.** No ellipsis. Long-press a session for the native context menu with Delete (confirmation follows); VoiceOver gets Delete as an action. Settings → Clear history deletes every completed workout.

13. **Plan activate / delete.** Plans is a 28pt tab title with a `+`. The active plan sits on top as a larger row with a green **Active** caption; other plans are 17pt rows below. The iOS context menu has Use this plan (labelled "(Pro)" for free users) / Delete. The editor has Use this plan if it isn't active, and Delete plan in red. Remove a day from its context menu or from **Remove day** in the day editor. A plan keeps at least one day.

14. **Onboarding caption.** Paper JSX is 22pt medium for “A plan. Then the gym.” (skill table still says 15). Implemented at 22.

15. **Done.** No checkmark. `Done` 64, then a facts line (day, duration), then per exercise the name plus compressed set lines (`80 × 8 · 8 · 7`) with a PR crown on exercises that set a personal best. Green Done pill. The recap is not capped; it scrolls. Swipe-back is off.

16. **Exercise strip.** Same name as the 34pt title. The strip scrolls horizontally; it does not nickname.

17. **Alternatives.** Same primary muscle from the local catalog, up to three. Copy is equipment, not Paper’s written jokes (“If the bar is taken”).

18. **Rest length.** Paper's rest artboard shows ~1:32. The app sizes rest per exercise: 150s compounds, 60s isolation, 90s unknown strength, 45s mobility, 30s cardio / stretch / timers. An exercise's own `restSeconds` (timers) wins.

19. **Empty weight / prefill.** First session wells start empty (`—`). On a weighted exercise, the first Log set with no weight focuses the weight well once and the CTA reads **Log without weight**; logging then stores `8 reps` instead of `80 × 8`. Logging a set copies its weight and reps into the remaining unlogged sets of that exercise. The next session prefills every set from last time (matching set, or the last set of that exercise if this session has more sets). Wells have −/+ steppers with a selection haptic.

20. **Exercise sheets.** The log's Exercise and Day sheets drag down to dismiss, with a light haptic when they snap. No extra Close link; Paper doesn't have one. There is no Home exercise sheet in 1.0 (see 6).

21. **Done → Pro.** Done opens the paywall after a completed workout when Pro is off and the post-workout paywall has never rendered prices (`postWorkoutPaywallShownAt`). It is recorded only once prices show, so a failed load offers it again next time. After the paywall closes, Done returns to the existing tabs (`dismissTo('/')`). The recap is reached only from Finish; History opens its own session screen.

22. **Unnamed plan discard.** Leaving New plan deletes the draft only if it still has no exercises. An untitled plan with work in it stays.

23. **Paywall from Settings and other gates.** "Not now" just goes back and never counts as the post-workout paywall. Gates (`requirePro`): second plan (Plans `+`), switching plans (context menu and editor), Progress windows beyond 3M on lift and body detail, and body trend charts. Settings → Trim Pro opens the paywall when off, and Manage Subscriptions when on (not for lifetime). Settings also has Restore purchases, Privacy Policy and Terms of Use.

24. **Haptics.** Light impact when a set is logged; success at rest end and at Finish; selection for well steppers, swiping between exercises, and picking a paywall option; light impact when a sheet snaps. Nothing else buzzes.
25. **Units on every number (Sep 2026).** Loads carry the user's unit wherever they appear (`60 kg × 8`) and prescriptions name the reps (`4 × 8 reps`). This replaces the rule that a screen states the unit once (G-9).
26. **Recaps list every set (Sep 2026).** Done and History session detail show each set on its own row with its number, instead of compressing same-weight sets into one line. The crown marks the PR set.
27. **Settings links (Sep 2026).** Rows that leave the app (Contact support, Privacy Policy, Terms of Use) sit in their own group with a trailing ↗ and the link role, so they don't read as settings.
28. **Body check-in (Sep 2026).** Check-in is a native form sheet (`/check-in`) with Cancel and Save in its header. Saving closes it and shows a "Check-in saved" toast. Toasts are only for confirming results that aren't on screen yet.
29. **Product analytics (Sep 2026).** PostHog (EU cloud) via `mobile/src/analytics/analytics.ts`, off until `EXPO_PUBLIC_POSTHOG_KEY` is set. Anonymous: no identify, no person profiles, no GeoIP, no session replay; events carry counts and choices only (onboarding_completed, workout_started, set_logged, workout_completed, check_in_saved, paywall_viewed, purchase_started/finished, restore_finished, plus screens and app lifecycle). Before a store build ships with a key: add PostHog to the privacy policy and add Analytics to Identifiers → User ID in App Privacy.
