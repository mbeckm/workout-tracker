---
name: implement-screen
description: Implements a Trim screen in mobile/ from the Paper design file. Use when adding or changing a mobile/ screen, or visually QA'ing Workout, Plans, Progress, History, Settings, onboarding or the paywall.
---

# Implement a screen

## Workflow

1. Read `.cursor/skills/trim-ui/SKILL.md`: principles (§1), the screen job table (§2), then the foundations you'll touch (type, spacing, color, icons, motion, copy) and the screen's row in §11.
2. Open the matching artboard on the Paper **Deliberate empty** page (or Family loop if that screen is not yet migrated). Do not implement from chat screenshots alone.
3. Product rules come from `PRODUCT.md` and `PRODUCT-DECISIONS.md`. Domain logic lives in `mobile/src/domain/`.
4. Implement in `mobile/` with Expo Router and tokens only: `type`, `space`, `radius`, `colors`, `iconSize`, `PRESSED_OPACITY` from `mobile/src/constants/theme.ts`, and `DURATION`, `SPRING`, easings from `mobile/src/motion.ts`. No raw font sizes, hex colors or off-scale spacing. If a screen you touch carries debt from `trim-ui` §15, fix it in the same change.
5. Do not invent hierarchy. Match the artboard: one winner, fact captions only, one green, thumb CTA.
6. Run it in the iOS Simulator and go through `trim-ui` §14 (QA) in light and dark, at default and large Dynamic Type. Fix mismatches; do not restyle toward Hevy or Strong.

## Guardrails

- Visual source of truth is `trim-ui`, then the Paper artboard for that screen. If they disagree, `trim-ui` wins; note the artboard for updating.
- Haptics and motion: only what `trim-ui` §8 lists. A new animation needs a purpose (faster, fluid, loveable), a spec and a row in the approved list.
- Behavior: never act on the user's behalf (`PRODUCT.md` → Principles → Control).
- Never skip Paper: critique → Paper → judge → then `mobile/`.
