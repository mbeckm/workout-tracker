---
name: implement-screen
description: Implements a Trim screen in mobile/ from the Paper design file. Use when adding or changing a mobile/ screen, or visually QA'ing Workout, Plans, Progress, History, Settings, onboarding or the paywall.
---

# Implement a screen

## Workflow

1. Read `.cursor/skills/trim-ui/SKILL.md`, especially **Philosophy: deliberate empty** and the screen job table.
2. Open the matching artboard on the Paper **Deliberate empty** page (or Family loop if that screen is not yet migrated). Do not implement from chat screenshots alone.
3. Product rules come from `PRODUCT.md` and `PRODUCT-DECISIONS.md`. Domain logic lives in `mobile/src/domain/`.
4. Implement in `mobile/` with Expo Router, the system font, and the semantic colors from `mobile/src/constants/theme.ts`.
5. Do not invent hierarchy. Match the artboard: one winner, fact captions only, one green, thumb CTA.
6. Run it in the iOS Simulator and compare against the artboard in light and dark mode. Fix mismatches; do not restyle toward Hevy or Strong.

## Guardrails

- Visual source of truth is `trim-ui` plus the current Paper artboard for that screen.
- Haptics only for: a logged set (light impact), rest end, Finish, Done on a new plan and Trim Pro turning on in the paywall (success), stepper and option selection (selection: well −/+, swiping between exercises, a paywall option), and a sheet snapping (light impact). Nothing else buzzes. See `PRODUCT-DECISIONS.md` item 24.
- Never skip Paper: critique → Paper → judge → then `mobile/`.
