---
name: figma
description: Use the Figma MCP server for ScratchWorkout design-to-code work. Trigger when implementing UI from Figma, comparing screens to design, resolving fidelity questions, or when the user shares a Scratch Figma URL or node link.
paths:
  - "ScratchWorkout/**/*.swift"
  - "DESIGN.md"
---

# Scratch Figma

Use the Figma MCP server to implement and validate ScratchWorkout UI. The visual source of truth is the Scratch Figma file; the code source of truth is `DESIGN.md`, `Theme.swift`, and `Components.swift`.

## Project links

| Resource | Location |
|----------|----------|
| Figma file | https://www.figma.com/design/NRr5uUZX4oAK3enRLXZi7j/Scratch |
| File key | `NRr5uUZX4oAK3enRLXZi7j` |
| Design spec | `DESIGN.md` |
| Color & typography tokens | `ScratchWorkout/ScratchWorkout/Theme.swift` |
| Shared UI components | `ScratchWorkout/ScratchWorkout/Components.swift` |
| Product context | `PRODUCT.md` |

## When to use

- Implementing or updating a screen, component, or layout from Figma
- Resolving design fidelity questions ("does this match Figma?")
- User provides a Figma URL or asks to match the Scratch design system
- Pushing SwiftUI views back into Figma (use `use_figma` write tools)

## MCP setup

| Environment | Status |
|-------------|--------|
| **Cursor IDE** | Supported — authenticate in Settings → MCP |
| **Cloud Agents** | Not supported yet (Figma allowlist) — use `DESIGN.md` + code tokens instead |

In the IDE, if tools fail: toggle Figma MCP off/on, confirm auth, and retry with a direct frame/layer link.

See `references/mcp-setup.md` for configuration details.

## Required flow (do not skip)

1. Parse the Figma URL to extract `fileKey` and `nodeId`.
2. Run `get_design_context` for the exact node(s).
3. If the response is truncated, run `get_metadata` first, then fetch child nodes individually with `get_design_context`.
4. Run `get_screenshot` for a visual reference of the node being implemented.
5. Read `DESIGN.md` and inspect existing `AppColor`, `AppFont`, and shared components before writing code.
6. Implement in SwiftUI using project tokens and components — never raw Figma hex values or ad-hoc fonts.
7. Validate against the screenshot and Figma sizing rules in `DESIGN.md`.

## URL parsing

Figma URLs follow this pattern:

```
https://www.figma.com/design/NRr5uUZX4oAK3enRLXZi7j/Scratch?node-id=1-2
```

- `fileKey` = `NRr5uUZX4oAK3enRLXZi7j`
- `nodeId` = convert `1-2` from the URL to `1:2` for MCP calls

Always use a link that points to the exact frame, component, or variant — not the file root.

## SwiftUI translation rules

Treat Figma MCP output (often React + Tailwind) as design intent, not final code.

### Tokens — map to `AppColor` and `AppFont`

| Figma / design token | Swift token |
|----------------------|-------------|
| `#0D0D0D` base | `AppColor.base` |
| `#1A1A1A` surface-1 | `AppColor.surface1` |
| `#242424` surface-2 | `AppColor.surface2` |
| `#2E2E2E` border | `AppColor.border` |
| `#FFFFFF` text-primary | `AppColor.primaryText` |
| `#8A8A8A` text-secondary | `AppColor.secondaryText` |
| `#4A4A4A` text-tertiary | `AppColor.tertiaryText` |
| `#A8FF3E` accent | `AppColor.accent` |
| Display / H1 / H2 / etc. | `AppFont.display`, `.h1`, `.h2`, `.subheading`, `.body`, `.label`, `.caption` |

Do not create parallel color constants or raw `Font.custom` calls outside `Theme.swift`.

### Components — reuse before creating

| Pattern | Use |
|---------|-----|
| Screen shell | `AppScreen` |
| Cards & panels | `CardShell`, `PlanCard`, `ExerciseCard` |
| Primary action | `CTAButton` |
| Progress bars | `StepProgress`, `DayStepProgress` |
| Numeric controls | `NumberStepper`, `RoundStepButton`, `DraftRoundButton` |
| Search & draft surfaces | `PlanEntrySurface`, `StatsSearchSurface`, `ExerciseDraftSurface` |
| Tab bar | `AppTabBar` |

### Layout constants (402×874pt reference frame)

- Horizontal padding: 24pt → content rail 354pt wide
- Bottom tab bar: 82pt tall
- Bottom CTA: 312×56pt, 106pt clearance from bottom
- Card gap: 12pt; section gap: 24pt (36pt for major breaks)
- Screen title starts at y=66pt after 46pt status reservation

Full sizing tables live in `DESIGN.md` under **Figma Sizing & Spacing**.

### Product guardrails

- Dark theme only — no light mode, gradients, or decorative imagery
- One bright green CTA per task screen
- Accent green is rare: CTAs, active tabs, progress completion only
- Inter is the only typeface
- Preserve custom bottom tab bar and thumb-zone actions
- Keep active workout logging stripped to current exercise + set entry

## Asset handling

- If Figma MCP returns a localhost asset URL for an image or SVG, use it directly
- Do not add third-party icon packages; use assets from the Figma payload
- Do not use placeholders when a real asset URL is provided

## Writing to Figma

When the task is to create or update nodes inside Figma (not implement code):

1. Load the `figma-use` plugin skill if available
2. Use `use_figma` MCP tools for canvas writes
3. Bind variables and reuse Scratch design tokens where possible

For full-page Figma generation from code, prefer `figma-generate-design` and `figma-swiftui` plugin skills.

## Validation checklist

Before marking UI work complete:

- [ ] `get_design_context` and `get_screenshot` were fetched for the target node
- [ ] Colors use `AppColor` tokens only
- [ ] Typography uses `AppFont` tokens only
- [ ] Existing components reused where applicable
- [ ] Layout matches Figma sizing rules (padding, CTA position, tab bar clearance)
- [ ] No new parallel design system or alternate product naming introduced

## References

- `references/mcp-setup.md` — MCP connection and troubleshooting
- `references/token-map.md` — full Figma-to-Swift token mapping
