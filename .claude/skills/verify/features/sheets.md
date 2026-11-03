# Menu and sheets

Everything list- or number-heavy lives in dark sheets over the device: the menu key opens the Trim menu (End workout during a session, then Plans, Progress, History, Settings and the Skin Library), the clock key on Home opens History, and every sheet is also reachable by link.

## Sub-features

- `sh-menu` menu sheet "Trim": Plans, Progress, History, Settings (+ End workout / Discard workout in a session).
- `sh-history` History: weeks with printed day slips; empty state "NO WORKOUTS YET".
- `sh-settings` Settings: Name, Weight units, Sounds, Trim Pro, Restore purchases, Contact support, Privacy Policy, Terms of Use, Clear history, version.
- `sh-plans` Plans rack, New plan, the list editor.
- `sh-progress` Progress: goals, estimated 1RM per lift, lift and body detail, check-ins.
- `sh-close` ✕ or a tap above the sheet closes it; the device stays underneath.

## How to get to it (user POV)

- Menu key (49, 99) → a row.
- Clock key on Home (353, 99) → History.
- Link: `tv open '?sheet=menu|plans|progress|history|settings|finishes'`.

## Driving it with the Simulator tool

Preconditions: baseline Home.

- **History by link.** `tv open '?sheet=history'`; on the first link after install tap Open (275, 474) on "Open in Trim?". The History sheet shows "NO WORKOUTS YET" over the dimmed device. Driven 2026-10-11.
- **Settings by link.** `tv open '?sheet=settings'`. Settings replaces History directly (no alert this time) and shows Name *Verify*, Weight units *kg*, Sounds on, Trim Pro *Off*, `Trim 1.0.0 (1)`. Driven 2026-10-11.
- **Close.** Tap above the sheet (366, 101) or ✕ (364, 145). Home returns. Driven (above-sheet tap) 2026-10-11.
- **Menu by key.** *(not yet driven)* Tap the menu key (49, 99). Sheet titled Trim with Plans, Progress, History, Settings. Tap a row; its sheet opens.
- **History by key.** *(not yet driven)* On Home tap the clock key (353, 99).
- **Proof of a setting change.** Change a value (e.g. Sounds), `tv state` before and after shows `soundsOn` flip.

## Gotchas

- The right key is History only on Home; in log mode it is Undo.
- A new `?sheet=` link replaces the open sheet rather than stacking.
- Contact support / Privacy / Terms open Safari in the Simulator; come back with `tv reload` or the app switcher.
- Clear history is destructive (undoable toast); only use it in Trim Verify.
