---
name: linear
description: Issue tracking and project management for ScratchWorkout using the Linear MCP server. Use when creating, updating, or querying Linear issues, linking PRs to tickets, managing sprint work, or when the user mentions Linear, tickets, or task tracking.
---

# Scratch Linear

Conventions for using the Linear MCP server with the ScratchWorkout iOS project.

## When to use

- Creating or updating Linear issues for ScratchWorkout work
- Finding open bugs, features, or sprint tasks
- Linking PRs and implementation notes to issues
- Updating issue status during development workflow
- Querying project backlog or current cycle

## MCP setup

Linear MCP must be connected and authenticated in Cursor:

1. Open Cursor Settings (`Ctrl/Cmd + Shift + J`) → **MCP**
2. Enable the **Linear** server
3. Authenticate with your Linear account when prompted

If tools return auth errors, re-authenticate in MCP settings. If the server disconnects, toggle it off and on — a known SSE reconnection issue.

See `references/mcp-setup.md` for the recommended MCP configuration.

## Discovering tools

Before calling Linear MCP tools, use `mcp_get_tools` with server `"Linear"` to inspect the current tool names and schemas. Tool names may vary by MCP version.

Common operations:

| Intent | Typical approach |
|--------|------------------|
| List teams / projects | Query teams and projects to find IDs |
| Create issue | Create with team, title, description, labels |
| Update issue | Update status, priority, assignee, or estimate |
| Search issues | Search by query, status, assignee, or project |
| Add comment | Attach PR links, findings, or status updates |

## Project context

When writing issue descriptions, reference ScratchWorkout conventions:

| Area | Details |
|------|---------|
| Product | Scratch — plan-first iOS strength-training tracker |
| Codebase | `ScratchWorkout/` Xcode project, SwiftUI |
| Design | `DESIGN.md`, Figma file (see `figma` skill) |
| Product spec | `PRODUCT.md` |
| Platform | iOS / SwiftUI |

Use area labels like `ios`, `swiftui`, `design`, `workout`, `plans`, or `stats` when available on your Linear team.

## Field conventions

### Title

Format: `type: short description`

| Type | Use |
|------|-----|
| `feat` | New feature or enhancement |
| `fix` | Bug fix |
| `chore` | Maintenance, refactoring, dependencies |
| `docs` | Documentation |
| `design` | Figma or design-system updates |

Examples:

```
feat: Add exercise reorder in plan edit mode
fix: Resolve tab bar overlap on Log Workout screen
design: Align Stats chart spacing to Figma
```

### Description

```markdown
## Context
Why this issue exists — user impact or product motivation.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
Relevant files, Figma links, or constraints.
Example: `ScratchWorkout/ScratchWorkout/WorkoutViews.swift`, Figma node link.
```

### Estimate (sizing)

| Points | Meaning |
|--------|---------|
| 1 | Small — under half day |
| 2 | Medium-small — half day |
| 3 | Medium — ~1 day |
| 5 | Medium-large — 2–3 days |
| 8 | Large — consider splitting |

Default to smaller estimates when unsure.

### Priority

| Priority | When |
|----------|------|
| Urgent | Production crash, App Store blocker, data loss |
| High | Current sprint commitment, user-facing bugs |
| Medium | Planned work (default) |
| Low | Nice-to-have, tech debt |

### Status workflow

```
Backlog → Todo → In Progress → In Review → Done
                     ↓
                  Blocked
```

- **In Progress**: limit WIP — one active issue per agent task when possible
- **In Review**: PR is open
- **Done**: PR merged and verified

## Workflow patterns

### Starting work on an issue

1. Fetch issue details via Linear MCP
2. Move status to **In Progress**
3. Read linked Figma nodes and `DESIGN.md` if UI work
4. Implement in `ScratchWorkout/` on a `cursor/<descriptive-name>-b89e` branch

### Submitting for review

1. Commit, push, and open a PR
2. Add a Linear comment with the PR URL
3. Move issue to **In Review**

### Completing work

1. After PR merge, move issue to **Done**
2. Add a brief comment if follow-up items exist

## Comment format

```markdown
**[PR Submitted]**
https://github.com/org/repo/pull/123

**[Technical Note]**
Reused `ExerciseCard` and `AppFont.h2` per DESIGN.md. Figma node: <link>
```

## Branch naming

Use Cursor cloud agent branch convention:

```
cursor/<descriptive-name>-b89e
```

Do not rely on Linear's auto-generated git branch names. Link work via PR description or Linear comments.

## Query examples

```
assignee:me is:open
priority:High label:bug
status:Blocked
project:"ScratchWorkout"
```

Adjust project and label names to match your Linear workspace.

## Anti-patterns

- Creating issues without acceptance criteria
- Leaving issues in **In Progress** after work is done
- Using 13-point estimates — split the issue instead
- Updating status without context — add a comment
- Creating duplicate issues for work already tracked in an open PR

## References

- `references/mcp-setup.md` — Linear MCP configuration for Cursor
