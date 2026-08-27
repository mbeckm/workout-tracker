# Product decisions to review

Picked while porting Family loop into `mobile/`. Scratch is usable; these are the calls to walk one by one.

1. **Log Cancel.** Paper only shows Finish. The app keeps a tertiary **Cancel** on the left so a mid-workout abort is possible without Finish → empty-sets alert. Finish still confirms discard if nothing was logged.

2. **Keyboard docking.** The log footer follows `react-native-keyboard-controller` so wells and Log set ride the system keyboard. The hero stays pinned. Native stack `keyboardHandlingEnabled` is off on Log, New plan, and Prescribe so the whole screen does not jump.

3. **Paywall prices.** Paper copy is `$49.99 a year` / `Monthly $5.99`. The screen uses real RevenueCat strings when they exist, and “Yearly” / “Monthly” when they don’t (Expo Go). Lifetime shows as a third line only if the offering has it. Subscribe is always the green pill; tapping a price line selects that plan.

4. **Prescribe edit.** Paper is a read-looking `4 × 8` list. Tap a row to dock SETS / REPS wells (same language as the log) above the keyboard. Values update as you type; empty is allowed until blur, then it clamps to 1–99. Remove is a red caption under the wells.

5. **Add day.** Paper doesn’t jump into the picker. **Add day** appends an empty day (Off). Tap it to add exercises.

6. **Home preview → GIF.** Tap a preview row opens the Exercise sheet (GIF only, no swap). Swap is log-only.

7. **Log strip.** Tap another chip to jump. Tap the 34pt name for the Exercise sheet (slides up; drag the sheet down to close). Tap the selected chip, or long-press any chip / the name, for the Day sheet. Day sheet caption still says “Drag to reorder”; long-press a handle and drag to move, tap a row to jump.

8. **In-session swap.** Replaces that slot on the plan and in the current log. Logged sets on that exercise are kept; if none are logged, sets rebuild from the new exercise.

9. **Rest.** Shown as `Rest` + timer above the wells. Tap the timer to skip. Rest continues when auto-advancing to the next exercise.

10. **Finished exercise.** Log set is disabled. Wells still show the last set (inspect).

11. **Previous.** Empty residue shows the last set from the last session + “Previous”. After the first logged set this session, previous hides; newest logged set is at the top of the well.

12. **History delete.** No ellipsis. Long-press a session to delete.

13. **Plan activate / delete.** Plans is a 28pt tab title plus 17pt rows. Green **On** marks the active plan. iOS context menu has Use this plan / Delete. Editor has Use this plan if it isn’t active, and Delete plan in red. Open a day to remove it (or long-press it in the editor). A plan keeps at least one day.

14. **Onboarding caption.** Paper JSX is 22pt medium for “A plan. Then the gym.” (skill table still says 15). Implemented at 22.

15. **Done.** No checkmark. `Done` 64, day 15, `n min` 15, stacked `80 × 8` lines, green Done pill. Recap is not capped at four exercises — it scrolls.

16. **Exercise strip.** Same name as the 34pt title. The strip scrolls horizontally; it does not nickname.

17. **Alternatives.** Same primary muscle from the local catalog, up to three. Copy is equipment, not Paper’s written jokes (“If the bar is taken”).

18. **Rest length.** Paper’s rest artboard shows ~1:32. The app uses size-based rest (150s compounds, 60s isolation, 90s default) so bench isn’t on the same clock as curls.

19. **Empty weight / last set.** First session wells start empty (`—`). Logging without a load stores `8 reps` instead of `80 × 8`. The next set on that exercise keeps the weight and reps you just logged. The next session prefills every set from last time (matching set, or the last set of that exercise if this session has more sets).

20. **Home exercise sheet.** Swipe to dismiss. No extra Close link — Paper doesn’t have one.

21. **Done → Pro.** After a logged session, Done opens the paywall if Pro is off and it hasn’t been seen. Opening the same recap from History just goes back. (An earlier “workout is in history” check skipped the paywall entirely.)

22. **Unnamed plan discard.** Leaving New plan deletes the draft only if it still has no exercises. An untitled plan with work in it stays.

23. **Paywall from Settings.** Not now there just goes back. It does not count as the post-workout paywall.
