# Skins and Trim Pro

Six skins, each a whole machine: Aluminium and Graphite free (Graphite earned in the tour), Field, Pocket, Bunker and Holo with Trim Pro. The Skin Library shows them on a row of machines; a free skin is saved with Use <skin>, a Pro one offers Try Trim Pro, which opens the paywall. The paywall also appears once after the first completed workout and from Settings.

## Sub-features

- `sk-library` Skin Library sheet: the row of machines, current skin.
- `sk-use` Use <skin> on a free skin reskins the device.
- `sk-try-pro` Try Trim Pro on a locked skin opens the paywall.
- `pro-paywall` paywall: headline, features, terms, CTA, Not now.
- `pro-restore` Settings → Restore purchases.

## How to get to it (user POV)

- Menu key (49, 99) → the skin card in the menu (accessibility label "Skin Library, skin <n>, <name>").
- `tv open '?sheet=finishes'`.
- `tv open 'paywall'`, Settings → Trim Pro, after the first finished workout.

## Driving it with the Simulator tool

Preconditions: baseline Home (Graphite, not Pro). `tv state before-skin` → `finish=101 pro=False`.

- **Open the library.** *(not yet driven)* `tv open '?sheet=finishes'`. Sheet "Skin Library" with the machines.
- **Use a free skin.** *(not yet driven)* Swipe to Aluminium, tap Use Aluminium. The device reskins. `tv state` → `finish=212`.
- **Try Pro.** *(not yet driven)* Swipe to Field, tap Try Trim Pro. The paywall shows (headline, features, CTA, Not now). Tap Not now; back on the device, skin unchanged.

## Gotchas

- Never complete a purchase: the CTA hits RevenueCat sandbox and needs an Apple sandbox account only Marvin can sign in with.
- The paywall shows once after the first completed workout (`postWorkoutPaywallShownAt` in state); a second finish won't show it.
- Pro state comes from RevenueCat; it can't be faked through the UI and must not be faked through storage.
