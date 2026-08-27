---
name: implement-screen
description: Implements a Scratch Expo screen from Paper Family loop. Use when adding or changing a mobile/ screen, or visually QA'ing workout, plans, history, settings, onboarding, or paywall.
---

# Implement a screen

## Workflow

1. Read `.cursor/skills/scratch-ui/SKILL.md` — especially **Philosophy: deliberate empty** and the screen job table.
2. Open the matching artboard on Paper **Deliberate empty** (or Family loop if that screen is not yet migrated). Do not implement from chat screenshots alone.
3. Product rules from `PRODUCT.md`. Domain behavior from `ScratchWorkout/` — not its visuals.
4. Implement in `mobile/` with Expo Router, system font, iOS semantic colors from `mobile/src/constants/theme.ts`.
5. Do not invent hierarchy. Match the Paper artboard: one winner, fact captions only, one green, thumb CTA.
6. If Expo MCP local tools are connected, screenshot the simulator and compare to that Paper artboard. Fix mismatches; do not restyle toward Hevy/Strong/`references/1.0`.

## Guardrails

- Visual source of truth is `scratch-ui` + the current Paper artboard for that screen.
- `references/1.0/` is historical. Do not match its tables, blue titles, or AP log chrome.
- Haptics only when a set is logged.
- Never skip Paper: critique → Paper → judge → then `mobile/`.
