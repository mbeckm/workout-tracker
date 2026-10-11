# Onboarding

A fresh install opens on the welcome screen and ends with a real plan loaded into the device: the owner names themself, picks units, chooses where the plan comes from (import, a starter plan, or build my own), picks days a week and a plan, picks a skin, and watches the plan load. The guided tour then starts on the device and ends by gifting the Graphite skin.

## Sub-features

- `ob-welcome` welcome with the empty device ("INSERT PLAN") and Continue.
- `ob-name` "What should we call you?" name field.
- `ob-units` kg / lbs.
- `ob-source` "Got a plan?": I have one (Note / AI chat / Workout app) → import, Pick one for me → starter plans, Build my own.
- `ob-days` "Days a week" wheel (default 3).
- `ob-plan` "Pick a plan" for that day count (3 days: Full Body, Push Pull Legs, Build my own).
- `ob-skin` "Pick your skin" (Aluminium free, Graphite EARN, four PRO), then **Load <plan>**.
- `ob-load` the device shows LOADED <PLAN> and loads each day.
- `ob-tour` the guided tour ("HI, I'M TRIM. TAP MY SCREEN TO GO ON", Show me / Skip) and the Graphite reward ("NEW SKIN UNLOCKED", Use Graphite).

## How to get to it (user POV)

- First launch after install (`tv fresh`).
- `?tour=1` replays only the tour on an onboarded install (dev builds).

## Driving it with the Simulator tool

Preconditions: `tv fresh` printed `app loaded`; the screenshot shows the welcome screen.

- **Welcome.** Tap Continue (201, 810). The name screen slides in.
- **Name.** Tap the field (201, 220), `text` "Verify". Tap Continue (201, 497), which sits above the keyboard. Units slides in.
- **Units.** kg is preselected. Tap Continue (201, 810). "Got a plan?" appears with "I have one" outlined.
- **Starter plans.** Tap "Pick one for me" (201, 638); it takes the orange outline. Wait ~1.5 s (a Continue tapped right away is swallowed), then tap Continue (201, 810). "Days a week" shows 3.
- **Days.** Tap Continue (201, 810). "Pick a plan / 3 days a week" with Full Body outlined.
- **Plan.** Tap Continue (201, 810). "Pick your skin" with Aluminium selected and **Load Full Body**.
- **Load.** Wait ~1 s, then tap Load Full Body (201, 810). The device fills the screen: LOADED / FULL BODY / 1/3 with a progress bar. `tv state onboarded` → `onboarded=True name='Verify' units=kg finish=212 tourDone=False plans=['Full Body']`.
- **Tour skip.** About 6 s after Load, the display reads "HI, I'M TRIM. TAP MY SCREEN TO GO ON"; tap Skip (353, 99). The display shows READY / "THAT'S THE TOUR, VERIFY. ▸" with Start greyed.
- **Outro.** Tap the display (201, 400). It types "PRESS START. SOMETHING'S WAITING FOR YOU." and Start lights orange (~5 s).
- **Reward.** Tap Start (201, 705). Graphite gift: "NEW SKIN UNLOCKED", Use Graphite. Tap it (201, 806).
- **Proof.** Home on Graphite: WEEK 1, FULL BODY A (~45 min, Barbell Back Squat 4×6, Flat Barbell Bench Press 4×8, Barbell Row 3×10, +2 more), FULL BODY B, FULL BODY C, Start. `tv state home` → `finish=101 tourDone=True`. `tv logs` shows `onboarding_completed {"path":"template", …}`, `plan_activated`, `tour_started`, `tour_skipped`, and after Use Graphite `tour_completed {"finish":"101"}`.

## Gotchas

- Taps during a slide or selection animation are swallowed (seen on Load Full Body and on Continue right after picking a card). Screenshot or wait ~1.5 s, then tap.
- The Continue button's position differs between screens (with keyboard: y 497; plan source: x 225).
- Skip doesn't jump to Home: the outro waits on ▸ until the display is tapped, and then still needs Start → Use Graphite.
- Running onboarding again needs `tv fresh`; it wipes all app data in Trim Verify.
