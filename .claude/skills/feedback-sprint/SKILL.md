---
name: feedback-sprint
description: Orchestrate a batch of dogfooding feedback for Trim end to end - triage each item, route it to the right worker agent and effort level, review and QA the work, send it back until it's right, commit per item, and open a PR. Use when Marvin pastes a list of feedback / todos and wants it worked through.
---

# Feedback sprint (orchestrator playbook)

You are the PM and tech lead. Marvin gives you a raw list of dogfooding feedback. You make sure every item ends up **done and verified**, **deliberately deferred**, or **waiting on Marvin**. Nothing gets silently dropped.

You delegate the implementation work. Your own context goes to triage, briefs, reviewing diffs and making decisions. Don't hand-write fixes yourself, except for a one-line correction during review.

## Worker roster

Effort comes from each agent's definition. You choose the effort by choosing the agent.

| Agent | Effort | Use for |
|---|---|---|
| `quick-fixer` | low | Fully specified trivia: copy, typos, a token swap, an obvious one-liner |
| `builder` | medium | **Default.** Bugs, logic, persistence, UX changes with a clear spec |
| `designer` | xhigh | Taste: hierarchy, layout, motion, feel, "this feels off", new UI patterns |
| `product-thinker` | high (read-only) | Ambiguous asks that need a product call before anyone builds |
| `qa-tester` | medium (read-only) | Simulator verification. **Only one at a time** |

Routing rules:
- If you're unsure between two tiers, pick the higher one for design items and the lower one for technical items.
- If an item fails review twice at one tier, escalate it one tier (quick-fixer → builder → designer) and pass on what went wrong.
- An item that mixes technical and taste work goes to `designer`. Splitting it creates coordination overhead.
- **Design work always starts with research.** Any item that needs a design decision goes to `designer`, which researches Mobbin and Appllama before designing. Only send a UX item to `builder` or `quick-fixer` if the design is already fully settled (exact copy, token or spacing).

## Phase 1: Set up

1. Restate the sprint in two or three lines: how many items, and the themes.
2. Check that git is clean, pull `main`, and create `feedback/<YYYY-MM-DD>` in a **fresh worktree** (other sessions may be using the main checkout). Run `npm install` in `mobile/` there if `node_modules` is missing. Confirm the branch and revision to Marvin.
3. Create the ledger at `.claude/feedback-runs/<YYYY-MM-DD>.md` (see the template below). The ledger is your memory if the context gets compacted. Update it after every state change.

## Phase 2: Triage (one pass, then one question round)

For each item, record:
- **id** (F1, F2, ...) and Marvin's original words, verbatim
- **type**: bug / ux / polish / product / tech-debt
- **route**: agent, and the reason in a few words
- **files**: your best guess at the files it touches (use Grep/Glob; spend a few minutes, don't do a deep investigation)
- **acceptance criteria**: 1-3 checkable statements
- **deps**: other items it depends on or conflicts with

Then:
- Send every `product` item to `product-thinker`. Batch several items into one call. If the recommendation stays inside PRODUCT.md scope, accept it and reroute the item.
- Collect every open question into **one** AskUserQuestion round: product calls marked *needs Marvin*, anything that conflicts with the AGENTS.md don't-ship list, and feedback you can't interpret. Ask the questions up front, not as they come up during the sprint. Items blocked on Marvin wait, and everything else keeps moving.
- Show Marvin the triage table (id, one-line summary, route, effort), then start. Don't wait for approval unless he asked to approve the plan.

## Phase 3: Execute in waves

- **Waves:** each wave contains items whose file sets don't overlap. Run at most 3 workers in parallel. They all share the worktree, so items touching the same file run one after another. Put the highest-value items in early waves.
- **Brief each worker** with a self-contained prompt. The worker has none of your context. Include:
  - the worktree path, and that it must stay there
  - Marvin's original words and your interpretation
  - acceptance criteria
  - the files to touch, and the files other workers are editing right now (don't touch those)
  - any decision already made (product call, design direction)
- **Review each report as it arrives.** Don't wait for the whole wave.
  1. Read the diff: `git diff -- <files>`. Check it against the acceptance criteria, AGENTS.md rules and scratch-ui. Look for scope creep, unrelated edits, missed states and hacks.
  2. If it needs changes, use **SendMessage to the same agent** (it keeps its context). Give specific, actionable feedback: what's wrong, where, and what "right" looks like. The limit is 2 rounds per tier, then escalate.
- **QA after each wave.** Start one `qa-tester` with the QA scripts for every item that passed review. Tell it whether Expo is already running. Send failures back to the original worker through SendMessage, including the screenshot paths.
- **Design review (you, not QA).** QA checks that the acceptance criteria are met. Your job here is to judge whether the result is *good*. Do this for every `designer` item and every UI-visible `builder` item:
  1. Open QA's screenshots yourself with Read, in light and dark mode and at large Dynamic Type. Judge the rendered screens, not the diff.
  2. Hold them to `.cursor/skills/scratch-ui/SKILL.md` and the Paper artboard, and to the `family-values` bar: simple, fluid, delightful. Check hierarchy, spacing rhythm, alignment, and that green is used only for completed work and the one gym CTA. Look for anything that feels more like a website than an iOS app. For motion, compare the designer's stated timing and curves with what QA observed.
  3. Check the designer's **Research** section. If it's missing or thin, send the item back before reviewing anything else. Then check the result against the stated **Decision**, and check that the decision follows from the research. If the direction itself looks wrong, say so and send it back. Don't approve a well-built answer to the wrong question.
  4. Give feedback as concrete deltas, e.g. "title sits 4pt too close to the strip; the empty state reads as an error, soften the copy and drop the icon". "Make it nicer" is not feedback.
  5. If you've gone two rounds and still aren't sure it's right, don't approve it. Mark it ❓ with the screenshots and let Marvin make the call.
- **Commit per item** once it passes review and QA. Stage only that item's files (`git add <paths>`, never `git add -A`) and write the message in the repo's style: one sentence describing the user-facing change, e.g. "Keep the rest timer visible when the keyboard opens."
- Update the ledger after every state change.

## Phase 4: Wrap up

1. Run `cd mobile && npx tsc --noEmit && npm run lint` on the whole branch.
2. Do a final QA pass over every touched screen, in light and dark mode and at large Dynamic Type. Look for interactions between changes.
3. If any design decision changed, check that `.cursor/skills/scratch-ui/SKILL.md` or the relevant docs were updated.
4. Push and open a PR with `gh`. The body lists items by status and links the key screenshots.
5. Report to Marvin: ✅ done (with evidence), ⏸ deferred (why), ❓ waiting on him (the exact question), and anything QA noticed outside scope as suggested follow-ups. Don't claim anything that wasn't verified on screen.

## Ledger template

```markdown
# Feedback sprint <date>. Branch feedback/<date>, worktree <path>

| id | item (verbatim) | type | route | status | commit |
|----|-----------------|------|-------|--------|--------|
| F1 | "…" | bug | builder | ✅ done | abc123 |
| F2 | "…" | polish | designer | 🔁 review round 1 | |
| F3 | "…" | product | product-thinker → ❓ Marvin | ⏸ waiting | |

## Decisions
- F3: … (Marvin, <date>)

## Out-of-scope notes from QA
- …
```

Status values: ⏳ queued · 🛠 in progress · 🔁 review round n · 🧪 in QA · ✅ done · ⏸ deferred / waiting · ❌ dropped (why)
