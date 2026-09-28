---
name: feedback-sprint
description: Orchestrate a batch of dogfooding feedback for Trim end to end - triage each item, route it to the right worker agent and effort level, review and QA the work, send it back until it's right, commit per item, and open a PR. Use when Marvin pastes a list of feedback / todos and wants it worked through.
---

# Feedback sprint (orchestrator playbook)

You are the PM and tech lead. Marvin gives you a raw list of dogfooding feedback. You make sure every item ends up **done and verified**, **deliberately deferred**, or **waiting on Marvin**. Nothing gets silently dropped.

## Token budget (read first)

A sprint should cost about what working the items one by one would, not several times more. The costs that add up:

- **Every spawn is a cold start.** A new worker pays for its system prompt, AGENTS.md and whatever docs it reads before it does anything useful. A one-line copy fix done by a subagent costs many times what it costs you inline.
- **Every screenshot is paid for by everyone who reads it**, and it stays in that context for every later turn. Your own context is the most expensive one: it lives for the whole sprint.
- **Every review round and every send-back** re-sends a worker's growing context.

So:
- Do trivial items yourself (see routing). Delegate work that needs real exploration.
- One worker per **area**, not per item: give related items (same screen or module) to one worker in one brief.
- Reuse a live agent with **SendMessage** (same area, a follow-up, the next QA batch) instead of spawning a fresh one.
- Don't pre-investigate for workers. A quick Grep to name the likely files is enough; the worker reads the code anyway.
- AGENTS.md is already loaded into every agent. Never tell a worker to read it. Point workers at the **sections** of `trim-ui` they need, not the whole file.
- Read diffs, not screenshots. QA only checks that a change is there and works; Marvin judges look and feel himself.

## Worker roster

Effort and model come from each agent's definition. You choose them by choosing the agent.

| Agent | Model / effort | Use for |
|---|---|---|
| *(you, inline)* | — | Trivia: copy, typos, a token swap, an obvious one-liner. Do them right after triage, one commit per item |
| `quick-fixer` | Opus, low | Several small, fully specified fixes in one brief, when together they'd bloat your context (roughly 5+ files to read) |
| `builder` | Opus, medium | **Default.** Bugs, logic, persistence, UX changes with a clear spec |
| `designer` | Opus, high | Taste: hierarchy, layout, motion, feel, "this feels off", new UI patterns |
| `product-thinker` | Opus, high (read-only) | Ambiguous asks that need research before a product call. Rare |
| `qa-tester` | Opus, low (read-only) | Functional Simulator check: is it there, does it work. **One per sprint**, reused across waves |

Routing rules:
- If you're unsure between two tiers, pick the higher one for design items and the lower one for technical items.
- If an item fails review twice at one tier, escalate it one tier (inline/quick-fixer → builder → designer) and pass on what went wrong.
- An item that mixes technical and taste work goes to `designer`. Splitting it creates coordination overhead.
- A UX item goes to `designer` only if it needs a design decision. If the design is already settled (exact copy, token, spacing, or an existing trim-ui pattern applies), it goes to `builder` or inline.

## Phase 1: Set up

1. Restate the sprint in two or three lines: how many items, and the themes.
2. Check that git is clean, pull `main`, and create `feedback/<YYYY-MM-DD>` in a **fresh worktree** (other sessions may be using the main checkout). Run `npm install` in `mobile/` there if `node_modules` is missing. Confirm the branch and revision to Marvin.
3. Create the ledger at `.claude/feedback-runs/<YYYY-MM-DD>.md` (template below). It's your memory if the context gets compacted. Update it when an item is committed or its route changes, and before each wave; not on every status flip.

## Phase 2: Triage (one pass, then one question round)

For each item, record:
- **id** (F1, F2, ...) and Marvin's original words, verbatim
- **type**: bug / ux / polish / product / tech-debt
- **route**: agent (or inline), and the reason in a few words
- **area** and likely **files**: one quick Grep/Glob, no deep reading
- **acceptance criteria**: 1-3 checkable statements
- **UI-visible?** (decides whether it gets Simulator QA)

Then:
- Product calls: if the options are obvious from PRODUCT.md, write them yourself and put them to Marvin. Use `product-thinker` only when an item needs research into how other apps do it, and batch all such items into one call.
- Collect every open question into **one** AskUserQuestion round: product calls, anything that conflicts with the AGENTS.md don't-ship list, and feedback you can't interpret. Items blocked on Marvin wait; everything else keeps moving.
- Show Marvin the triage table (id, one-line summary, route), then start. Don't wait for approval unless he asked to approve the plan.
- Do the inline items now, before spawning anyone.

## Phase 3: Execute in waves

- **Waves:** group items by area into briefs whose file sets don't overlap. At most 3 workers in parallel; they share the worktree. Highest-value items first.
- **Brief each worker** with a self-contained prompt (the worker has none of your context), kept short:
  - the worktree path, and that it must stay there
  - per item: Marvin's words, your interpretation, acceptance criteria
  - files to touch, and files other workers are editing right now (don't touch those)
  - which `trim-ui` sections apply (e.g. "Log stage", "Voices"), and whether PRODUCT.md matters
  - decisions already made
- **Review each report as it arrives.**
  1. `git diff --stat`, then `git diff -- <files>` for that item. Check it against the acceptance criteria and the AGENTS.md / trim-ui rules. Look for scope creep, unrelated edits, missed states and hacks.
  2. If it needs changes, **SendMessage to the same agent** with specific deltas: what's wrong, where, what "right" looks like. Limit 2 rounds per tier, then escalate. Fix a one-liner yourself instead of sending it back.
- **QA is a functional check, not a design review.** It answers "is the change there, and does it work as the acceptance criteria say?" Look and feel is Marvin's call on device.
  - Only UI-visible items get Simulator QA. Logic-only items are verified by the diff and `npm run check`.
  - Write acceptance criteria QA can check literally ("tapping Skip moves to set 2 of 3"), not taste ("feels lighter").
  - Spawn one `qa-tester` for the first wave and **SendMessage it** for later waves; it keeps the app running and its context. Send it the batch of items with their QA scripts and criteria.
  - Send failures back to the original worker through SendMessage, with QA's repro text. Don't open the screenshots yourself unless the failure report is unclear.
- **Design check (you, from text).** For `designer` items, check that the report's **Decision** follows from its **Research** (or the trim-ui rule it cites) and that the diff respects trim-ui (system font, semantic colors, green only for completed work and the one gym CTA). Don't judge rendered screens; add the item to Marvin's look-and-feel list instead.
- **Commit per item** once it passes. Stage only that item's files (`git add <paths>`, never `git add -A`). Message in the repo's style: one sentence describing the user-facing change, e.g. "Keep the rest timer visible when the keyboard opens."

## Phase 4: Wrap up

1. `cd mobile && npm run check && npm run lint` on the whole branch (8 known lint errors on `main` aren't yours).
2. Only if two or more items touched the same screen: one functional QA pass over that screen. No full re-QA of everything.
3. If a design decision changed, check that `.cursor/skills/trim-ui/SKILL.md` or `PRODUCT-DECISIONS.md` were updated.
4. Push and open a PR. The body lists items by status with QA's pass/fail per criterion (screenshot paths are local, so don't link them).
5. Report to Marvin: ✅ done (with evidence), ⏸ deferred (why), ❓ waiting on him (the exact question), a short **look-and-feel list** for him to check on device (per UI item: the screen, the state to reach, and what changed; include dark mode / large text only where the layout changed), and anything QA flagged as plainly broken outside scope. Don't claim anything that wasn't verified.

## Ledger template

```markdown
# Feedback sprint <date>. Branch feedback/<date>, worktree <path>

| id | item (verbatim) | type | route | status | commit |
|----|-----------------|------|-------|--------|--------|
| F1 | "…" | bug | builder (logging) | ✅ done | abc123 |
| F2 | "…" | polish | inline | ✅ done | def456 |
| F3 | "…" | product | ❓ Marvin | ⏸ waiting | |

## Decisions
- F3: … (Marvin, <date>)

## For Marvin to check on device
- …
```

Status values: ⏳ queued · 🛠 in progress · 🔁 review round n · 🧪 in QA · ✅ done · ⏸ deferred / waiting · ❌ dropped (why)
