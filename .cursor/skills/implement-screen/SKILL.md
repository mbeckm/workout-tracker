---
name: implement-screen
description: Implements a Trim screen in mobile/ from trim-ui and the agreed Claude Design variation. Use when adding or changing a mobile/ screen, or visually QA'ing Workout, Plans, Progress, History, Settings, onboarding or the paywall.
---

# Implement a screen

## Workflow

0. Name the flow the screen belongs to (entry points, steps, exits, where the user lands, edge states) and check the agreed design covers all of it (AGENTS.md → Design first, rule 5; `trim-ui` §1 rule 17). If a step of the flow isn't designed, design it before building.
1. Read `.cursor/skills/trim-ui/SKILL.md`: principles (§1), the screen job table (§2), then the foundations you'll touch (type, spacing, color, icons, motion, copy) and the screen's row in §11.
2. Work from the variation Marvin picked in Claude Design and the screen's current code. In a local session with Paper open, the matching artboard (page **Deliberate empty**, or Family loop) is an extra, possibly outdated reference; in a cloud session skip it.
3. Product rules come from `PRODUCT.md` and `PRODUCT-DECISIONS.md`. Domain logic lives in `mobile/src/domain/`.
4. Implement in `mobile/` with Expo Router and tokens only: `type`, `space`, `radius`, `colors`, `iconSize`, `PRESSED_OPACITY` from `mobile/src/constants/theme.ts`, and `DURATION`, `SPRING`, easings from `mobile/src/motion.ts`. No raw font sizes, hex colors or off-scale spacing. If a screen you touch carries debt from `trim-ui` §15, fix it in the same change.
5. Do not invent hierarchy. Match the artboard: one winner, fact captions only, one green, thumb CTA.
6. Run it in the iOS Simulator and go through `trim-ui` §14 (QA) in light and dark, at default and large Dynamic Type. Fix mismatches; do not restyle toward Hevy or Strong.

## Guardrails

- Visual source of truth is `trim-ui`, then the current code, then Paper (frozen, local only). If they disagree, `trim-ui` wins; Paper is not updated.
- Haptics and motion: only what `trim-ui` §8 lists. A new animation needs a purpose (faster, fluid, loveable), a spec and a row in the approved list.
- Behavior: never act on the user's behalf (`PRODUCT.md` → Principles → Control).
- Never skip design: critique → Claude Design (several variations, broad conceptual range; see AGENTS.md → Design first) → Marvin picks → then `mobile/`.
