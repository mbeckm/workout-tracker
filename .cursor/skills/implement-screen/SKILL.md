---
name: implement-screen
description: Implements a Trim surface in mobile/ (a device mode, a sheet or a moment) from trim-ui, design/gadget/SPEC.md and the prototype, and verifies it against design/gadget/screens side by side. Use when adding or changing anything in mobile/'s UI, or visually QA'ing Home, logging, rest, finish, plan edit, any sheet, onboarding or the paywall.
---

# Implement a surface

## Workflow

1. Read `.cursor/skills/trim-ui/SKILL.md`: principles (§1), structure and the key map (§2), then the foundations you'll touch (type, geometry, color, motion, copy) and the surface's section in §13.
2. Find the target: its file in `design/gadget/screens/` (and `frames/` for the insert), its state in `design/gadget/prototype/trim-gadget-prototype.html` (read its CSS and JS for any value SPEC doesn't list), and its numbers in `design/gadget/SPEC.md`. These are the specification history: `trim-ui` and the shipped code in `mobile/src/device/` win where they differ. Paper and old screenshots are obsolete.
3. Product rules come from `PRODUCT.md` (Principles, Control) and `PRODUCT-DECISIONS.md` (73). Domain logic lives in `mobile/src/domain/` (and the pure `mobile/src/device/*-model.ts` files) and is reused, not rewritten.
4. Build from the shared parts, never per-screen copies:
   - **Device parts** in `mobile/src/device/parts/`: `DeviceBody`, `RoundKey`, `TallKey`, `Rocker`, `Lamp`, `Display`, `Drum`, `BigKey`, `Well`, `HoldRing`, `Wheel`, `EngravedLabel`. Device state lives in `src/device/device-state.ts` (pure, no `react-native` import); logging logic in the `src/device/log/` hooks.
   - **Sheet primitives:** `SheetHost`, `SheetHeader`, `SheetCard`, `SheetRow`, `SectionLabel`, `PillButton`, `StickyActionBar`, `Chip`, `Segmented`, `ObjectIcon`, plus `Toast`. Open sheets through the device command API (`useDevice().open(...)`), never a route, `Modal` or `formSheet`.
   - A missing part or primitive is added to the shared set (and to the gallery), not drawn inline.
5. Tokens only: the device palette per finish, `lcd`, `sheet`, `signal`, the type roles, the `device` geometry block, `space`, `radius`, `PRESSED_OPACITY`, `TOUCH_TARGET`, `fontScaleCap` from `mobile/src/constants/theme.ts`, and `DEVICE` durations and easings and `REST_GO_MS` from `mobile/src/motion.ts`. Haptics through `useHaptics()` and sounds through `TrimDevice`, with their named patterns (trim-ui §8). No raw font sizes, weights, hex colors, radii or off-scale spacing.
6. Check new or changed parts in the dev gallery, `mobile/src/app/dev-gallery.tsx` (`__DEV__` only): every part in every state and finish at 390 × 844. Add your part's states there.
7. Verify visually (below) and walk trim-ui §15 (QA): every finish where the device shows, the largest accessibility text size in sheets, Reduce Motion, VoiceOver, iPhone SE and Pro Max.

## Visual verification (PLAN §10)

1. `npx expo run:ios`, open the state, and take a screenshot with `xcrun simctl io booted screenshot <file>` (390 × 844 points: iPhone 13/14/15/16 base).
2. Put it next to the target: `magick design/gadget/screens/<target>.jpg <actual>.png +append compare.png`. If ImageMagick isn't installed, use Pillow (`python3 -c` with `PIL.Image`: open both, scale to the same height, paste side by side). Read `compare.png`.
3. List every visible difference: position, size, colour, type, radius, shadow.
4. Fix it, or justify it in the ledger. Tolerance: 2 pt for layout, exact token colours, the same font roles.

Cloud sessions without a Simulator: the web export gives layout only (no native fonts or shadow parity). Use EAS Simulator (`.agents/skills/eas-simulator/SKILL.md`) for iOS screenshots, or mark native-only checks `needs-device` and continue.

## Guardrails

- Visual source of truth: `trim-ui`, then the shipped device code, then SPEC, the prototype and `screens/` as targets. When the code changes a rule, fix `trim-ui` in the same change.
- Motion, haptics and sounds: only what `trim-ui` §8 lists, at SPEC's timings. A new one needs a purpose (faster, fluid, loveable), a spec and a row in §8.
- Behaviour: never act on the user's behalf (`PRODUCT.md` → Control). Timers inform, they don't act.
- Never mix layers: no bevels or gradients in sheets, no flat list on the device.
- Guard native modules for web (`Platform.OS === 'ios'` or platform files) so the web smoke test can't crash.
- `npm run check` must pass. Never raise the design-token baseline.
- New features still go through Claude Design first (AGENTS.md → Design first).
