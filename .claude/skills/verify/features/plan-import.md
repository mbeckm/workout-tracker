# Plan import

The owner brings a plan they already have: pasted text or screenshots go to the `trim-api` server (Claude reads the plan) or, offline, to on-device text recognition and the local parser; Trim shows what it read, lets the owner fix lifts it didn't recognise, and loads the plan.

## Sub-features

- `imp-entry` entry from onboarding ("I have one") or New plan → Import plan.
- `imp-paste` Paste: text from the clipboard.
- `imp-shots` Screenshots: pick images from Photos.
- `imp-read` reading step, then Continue / Try again on an empty result.
- `imp-fix` fixing unknown lifts, then Continue to load.

## How to get to it (user POV)

- Onboarding → "Got a plan?" → I have one → Continue.
- Menu → Plans → New plan → Import plan.
- `tv open '?sheet=import'` or `?sheet=new-plan`.

## Driving it with the Simulator tool

Preconditions: baseline Home, or `tv fresh` for the onboarding path. Network reachable (the server path), or note that the offline fallback was exercised.

- **Put text on the Simulator clipboard.** `printf 'Day A\nBack squat 4x6\nBench press 4x8\n' | xcrun simctl pbcopy "Trim Verify"`.
- **Open import.** *(not yet driven)* `tv open '?sheet=import'`. Sheet "Import plan" with Paste and Screenshots buttons.
- **Paste.** *(not yet driven)* Tap Paste; iOS may ask to allow pasting (tap Allow Paste). The reading step lists the days and lifts.
- **Continue.** *(not yet driven)* Tap Continue; fix unknown lifts if listed; the plan loads (cartridge insert). `tv state` → the new plan in `plans`, `activePlanId` set to it.

## Gotchas

- Real content leaves the device here (decision 88): use made-up plans only.
- Screenshots need images in the Simulator's Photos: `xcrun simctl addmedia "Trim Verify" <png>`.
- The first paste triggers iOS's paste permission alert.
