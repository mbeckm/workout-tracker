# Final visual evidence (PLAN §11)

Captured 3 Oct 2026 from detached `gadget/main` @ `57c587d`. Device: iPhone 17 Pro simulator, dev build. Metro ran on port 8083 with in-memory fixtures only, so no real data was touched. The fixtures were `EXPO_PUBLIC_HOME_DEMO=gadget | gadget-plans | gadget-history | gadget-seven` and `EXPO_PUBLIC_PROGRESS_DEMO=gadget`. The Expo dev-menu floating button was hidden for the screenshots.

In every `sbs-*.jpg` the target is on the left and the simulator on the right. Both are scaled to 1000 px tall, and the simulator image includes the status bar.

## 1. Every target screen

| Target | Evidence (fresh) | Earlier phase evidence | Remaining differences |
|---|---|---|---|
| 01-home | `sbs-01-home.jpg` | `p3/cmp-01.jpg`, `p1/home-212-sbs.jpg` | None beyond tolerance. The display is a little taller on 17 Pro (taller screen, p3). |
| 02-history-wall | `sbs-02-history-wall.jpg` | `p5/cmp-02.jpg` | Fixture dates and loads differ, so the PR stamps read `3 PRS`. Minis are sized to the screen width (p5). |
| 03-history-receipt | `sbs-03-history-receipt.jpg` | `p5/cmp-03.jpg` | The name line under TRIM is deliberate (D20). Share replaces Copy (PLAN). The lifts come from the fixture. |
| 04-log-set | `sbs-04-log-set.jpg` | `p4/04-compare.jpg`, `p1/log-212-sbs.jpg` | The footer reads `TARGET 82.5×8` instead of `LAST 80×8` because the fixture is Pro and has a target (log-display rule). The weights are demo data (p4). |
| 05-log-adjusted | `sbs-05-log-adjusted.jpg` | `p4/05-compare.jpg` | Set 2/3 here instead of 1/3: the capture came after a logged set. Footer as in 04. |
| 06-exercise-sheet | `sbs-06-exercise-sheet.jpg` | `p4/sbs-bench-you.jpg` (has the figure and HOW TO) | Fixture artefact: the gadget fixture renames the lift to "Bench Press", and the catalog lookup is by name, so the figure, HOW TO and the secondary muscles are missing. With the catalog name (p4) they show. YOU shows `Best today` mid-session, and there's no `Top 36%` (D4, no rank). |
| 07-today-sheet | `sbs-07-today-sheet.jpg` | `p4/07-compare.jpg` | `Add lift` row (Phase 4). The odd loads (`at 81`) are demo data (the fixture logs every lift at 80). |
| 08-rest | `sbs-08-rest.jpg` | `p4/08-compare.jpg`, `p1/rest-212-sbs.jpg` | Countdown value and the fixture's `NEXT`. The remaining ring shows ticks (SPEC). |
| 09-rocker-next-lift | `sbs-09-rocker-next-lift.jpg` | `p4/09-compare.jpg` | Demo loads (81 kg cable fly). Footer as in 04. |
| 10-menu-during-workout | `sbs-10-menu-during-workout.jpg` | `p4/10-compare.jpg` | The Discard workout row (p4) and the Settings row (D1) push History lower. |
| 11-finish-hold | `sbs-11-finish-hold.jpg` | `p4/11-compare.jpg`, `p1/finish-212-sbs.jpg` | No `HOLD TO FINISH` (gesture hint, p1/p4). The wheel is stowed in finish (p4). The undo key stays at top right. |
| 12-finish-holding | `sbs-12-finish-holding.jpg` | `p4/12-compare.jpg` (ring further along) | The frame caught the ring just starting; p4 shows it mid-fill. Otherwise as 11. |
| 13-receipt-prints | `sbs-13-receipt-prints.jpg` (mid-feed) | `p5/cmp-13.jpg` | Name line (D20), Share instead of Copy (PLAN). |
| 14-home-day-stamped | `sbs-14-home-day-stamped.jpg` | `p3/cmp-14.jpg` | **Bug:** the wheel is visible on Home after finishing; see Problems. `1 SET` singular and the weekday come from the fixture (p3). Target 14's orange ring is a prototype leftover (p3). |
| 15-menu | `sbs-15-menu.jpg` | `p2/menu-sbs.jpg` | Settings row (D1). Progress sub-line `9 lifts tracked`: no rank (D4). |
| 16-finishes | `sbs-16-finishes.jpg` | `p8/sbs-16-finishes.jpg`, `p2/finishes-sbs.jpg` | Home state behind the sheet (fixture). The strip shows 408 at the edge. |
| 17-finish-101 | `sbs-17-finish-101.jpg` | `p8/sbs-17-101.jpg` | Fixture state behind the sheet. Matches. |
| 17-finish-305 | `sbs-17-finish-305.jpg` | `p8/sbs-17-305.jpg` | Fixture state behind the sheet. Matches. |
| 17-finish-408 | `sbs-17-finish-408.jpg` | `p8/sbs-17-408.jpg` | The target highlights 305 under a "408" title (target inconsistency); the app highlights 408. |
| 18-progress | `sbs-18-progress.jpg` | `p7/cmp-18-final.jpg` | No gauge or rank (D4). Goal cards use full names. Body sits in its own card (p7). |
| 19-lift-detail | `sbs-19-lift-detail.jpg` | `p7/cmp-19-final.jpg` | Default range 1M. Goal control. Whole-number estimated max (p7). |
| 20-plans-rack | `sbs-20-plans-rack.jpg` | `p6/20-compare.jpg` | ✕ instead of ‹ because it was opened by deep link, not from the menu. |
| 21-plan-editor | `sbs-21-plan-editor.jpg` | `p6/21-compare.jpg` | Day header `…` (PA1). Fixture lifts. |
| 22-device-edit-sets-reps | `sbs-22-device-edit-sets-reps.jpg` | `p6/sbs-22.jpg` | Matches. |
| 23-add-lifts | `sbs-23-add-lifts.jpg` | `p6/23-compare.jpg` | The Recent chip comes first when recents exist, and "in this day" rows are dimmed (p6). |
| 24-plans-saved-filing | (not recaptured; it's a motion sequence) | `p6/24-compare.jpg`, `p6/24-filing-sequence.jpg` | As in p6. |
| 25-other-plan-use | `sbs-25-other-plan-use.jpg` | `p6/25-compare.jpg` | Day header `…`. Fixture lifts (Plank shows the timed `3 × 0:45`). |
| frames a–g (insert) | not recaptured | `p9/sbs-a…g.jpg`, `p6/sbs-js-a/b.jpg` | As in p9. |

## 2. Four finishes × Home, Log, Rest (iPhone 17 Pro)

The 12 shots are `finish-{212,101,305,408}-{home,log,rest}.jpg`, and `finishes-12.jpg` is the contact sheet.

Contrast was measured on the engraved labels; the display and key glyphs are the same on every finish.
- **Display** (orange LCD on black): readable on all four. The dim secondary text (`TARGET`, `REST`, ghost values) is intentionally faint and identical on every finish.
- **Key glyphs**: readable on all four. On 305 the big key turns black with a white word, which works. On 101 the disabled undo glyph is faint, as intended for the disabled state.
- **Engraved labels**:
  - 212 and 408: `WEEK 12`, `KG` and `TIME` are about 3:1, readable.
  - **101 Graphite: `WEEK 12` is about 1.5:1, grey on dark grey, and close to unreadable.** `KG` and `TIME` are fine (light on near-black).
  - **305 Signal: `WEEK 12` is about 2:1, peach on orange, and weak.** `KG` is about 3.5:1.

  Both weak labels match the targets (17-101 and 17-305 render them just as dim), so this is a design call rather than a code bug. Flagged for Marvin.

## 3. iPhone SE and Pro Max

- **Pro Max** (`promax-*.jpg`, contact sheet `promax-contact.jpg`): Home with 4 and with 7 days, Log, Rest, Finish, menu (home and in-workout), editor, progress and receipt. Nothing is clipped. Keys keep their size and the display grows. On the 7-day Home the rows scroll inside the display with a fade. `promax-home-after-finish.jpg` shows the wheel correctly stowed after a finish.
- **iPhone SE: not captured.** Claude was never granted tap access to "Trim SE": the request timed out, and iOS's "Open in Trim?" prompt needs a tap. To finish this, grant access from the simulator panel and rerun the same path.

## 4. Dynamic Type at AX3 (iPhone 17 Pro)

Shots are `ax-{home,log,menu,settings,settings-scrolled,editor,add-lifts,today,progress,history,receipt}.jpg`, and `ax-contact.jpg` is the contact sheet.
- The device stays fixed (Home, Log), and key words are capped.
- Settings, Progress, editor, History and receipt wrap or scroll and are usable.
- **Menu: the finish card's title wraps onto the device figure** (`bug-ax-menu-finish-card-overlap.jpg`). This one is a bug.
- Minor: on add lifts and Today, lift names truncate to one line (`Incline Bench Pre…`, `Overhead P…`) instead of wrapping. The kit line still tells variants apart.

## 5. Accessibility labels and order (web export, `--dev` + `gadget` fixture)

Files: `a11y-home.txt`, `a11y-log.txt`, `a11y-menu.txt` (Playwright `ariaSnapshot`, since `page.accessibility` has been removed).
- **Home order:** Menu, `WEEK 12`, rows, `Start Push 1`, `Weight` slider, History. This matches Phase 3 (menu, week, rows, Start, History) except for one extra item: the stowed wheel's slider shows up on web. On iOS `accessibilityElementsHidden` hides it; that needs a device check. The rows read as PLAN asks (`Push 1, next, 3 lifts, about 45 minutes`). The week's summary label (`Week 12, 2 of 4 days done`) is on a plain View, which web doesn't expose, so it needs a device check.
- **Log** (PLAN §7):
  - Rocker: `Previous lift` / `Today's lifts` / `Next lift` ✓
  - Keys: `More reps` / `Fewer reps` / `Log set` / `Undo last set` ✓
  - Wheel: the `Weight` slider ✓, but its spoken value isn't visible on web.
  - The display's single summary label exists in code (`work.display.summary`), but web shows the raw text, so it needs a device check.
- **Menu:** `Finish 212, Aluminium. Change finish`, `Plans, Push Pull Legs, 4 days`, `Progress, …`, `History, …`, `Settings`, `Close` ✓. On web the device stays in the tree behind the sheet and the heading comes after the rows. iOS uses `accessibilityViewIsModal`, which needs a device check.

## Problems found (not fixed)

1. **Wheel left out on Home after a finish** (`bug-home-wheel-after-finish.jpg`, `sbs-14-home-day-stamped.jpg`). On Pro, it happened after this path: wheel turn, Skip rest, Today, rocker next, End workout, hold Finish, Done. It stayed through row taps. It didn't reproduce on Pro Max with a short path (`promax-home-after-finish.jpg`).
2. **AX3 menu finish card**: the title is drawn over the device figure (`bug-ax-menu-finish-card-overlap.jpg`, `src/device/sheets/menu-sheet.tsx`).
3. Low-contrast engraved `WEEK n` on 101 (about 1.5:1) and 305 (about 2:1). It matches the targets.

## 6. Live Activity and paywall triggers (iPhone 17 simulator, in-memory fixtures)

- **Live Activity** (`la-0…7-*.jpg`): start, log on lift 1, rocker to lift 2, log; backgrounded → Dynamic Island compact countdown; long-press → expanded (lift name, orange countdown and bar); Lock Screen card with the countdown; tapping it opens Trim in log mode on lift 2 with the session intact; the countdown keeps running in the background and the activity flips to `Go` at 0:00. Compact and Lock Screen digits stay white (D16 replaced only the blue accent; expanded view and progress bar are orange). iOS's first-run "Allow Live Activities from Trim?" prompt was left unanswered.
- **Paywall triggers, free user** (`la-A…E-*.jpg`): targets (`TARGET ›`), second plan (`+`), progress window (6M), finishes (Get Trim Pro pill), Settings → Trim Pro. Each shows real prices from the store ($39.99/year with 7 days free, $6.99/month), a visible "Not now", and returns to where it was. Post-workout and onboarding paywalls: `p4`/`p8` evidence. Switch plan shares `requirePro` with second plan (the free fixture has one plan). Purchase and restore: Marvin on TestFlight.

## 7. iPhone SE (3rd gen, 375×667)

`se-*.jpg`: Home (4 and 7 days, scrolled), Log, Rest, Finish, menu, Today, receipt, stamped Home, Plans, editor, DAY EDIT, Progress, lift detail. Keys keep their size, the display shrinks, Home rows scroll inside it; nothing is clipped. The first pass found two overlaps (Log: `×8` over the dim next weight; Rest: `2:24` crossing the ring) — fixed by laying the display out from its measured height (`se-fix-after-se-*.jpg`): short displays drop the dim drum rows and shrink the rest ring; ≥360-pt displays are unchanged (`se-fix-sbs-17-log.jpg` vs 04, `se-fix-sbs-17-rest.jpg` vs 08). The finish set grid now fits any set count (`se-fix-after-finish-45*.jpg`).
