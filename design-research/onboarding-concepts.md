# ScratchWorkout Onboarding Concept Sprint

Research date: July 12, 2026

## Product activation definition

Onboarding is successful when a new user completes a first real set or workout within 72 hours. Finishing the onboarding screens is a supporting metric, not the goal.

All variants preserve Scratch's current product contract: local-first use, optional account creation, a reusable active plan, quick one-handed logging, and a handoff into Home or Start Workout. Every screen uses the existing black/charcoal/white/neon-green system, Inter typography, 24 pt rails, 12 pt card corners, and one 312 x 56 pt primary action.

## Variant A — First Set

Hypothesis: an immediate mastery moment will outperform explanation-heavy onboarding for experienced or high-intent lifters.

1. Promise: “Track a set without breaking your rhythm.” Actions: `Log a set` and `Choose a plan instead`.
2. Pick a familiar exercise from three common choices or search.
3. Log one sandbox set with the real weight/reps controls.
4. Success: “That’s the whole loop.” Show a baseline card, then offer `Save starter plan`.
5. Handoff to Start Workout; account and reminders remain deferred.

Behavioral basis: mastery experience, self-efficacy, self-monitoring, teach-through-action, progressive disclosure.

Mobbin precedents: Duolingo’s small interactive tasks and bounded progress; Headspace’s product-experience-before-reminder pattern; Strava’s immediate record action.

Key screen to visualize: the interactive first-set logger.

Primary experiment metric: first real set logged. Guardrails: time-to-first-set, sandbox abandonment, accidental demo-data persistence.

## Variant B — Built For Your Week

Hypothesis: a short, transparent personalization quiz followed by a strong value reveal will increase plan activation among users who want guidance.

1. Promise: “A strength plan that fits your goal, gear, and week.”
2. Goal: `Build muscle`, `Get stronger`, `Stay consistent`.
3. Experience: `New to lifting`, `Some experience`, `I know my program`.
4. Equipment and session duration, one question per screen.
5. Frequency using Scratch’s existing large stepper.
6. Plan reveal: a recommended three-day plan, a short `Why this fits` explanation, and `Edit`.
7. Review and activate; handoff to Home with the new plan visibly active.

Behavioral basis: autonomy, competence support, reduced preference uncertainty, transparent defaults, progressive disclosure.

Mobbin precedents: Runna’s one-question setup and human-readable plan review; Fitbod’s equipment/preferences flow; Equinox+’s explicit multi-step goals; Tempo’s plan selection.

Key screen to visualize: personalized plan reveal with rationale.

Primary experiment metric: recommended plan accepted and first workout started within 72 hours. Guardrails: quiz completion and answer-to-recommendation integrity.

## Variant C — Set Your Rhythm

Hypothesis: converting motivation into a concrete when-and-where plan will improve first-week follow-through among motivated users.

1. Pick a meaningful outcome and realistic weekly frequency.
2. Choose intended training days and a usual time/context.
3. Pick the most likely obstacle: `Work runs late`, `Low energy`, `No gym access`, `Not sure what to do`.
4. Create one editable backup: “If work runs late, I’ll do the 20-minute session.”
5. Commitment summary: `Mon · Wed · Fri at 18:30`, backup plan, and `Set my rhythm`.
6. Ask for a reminder only after the schedule exists; handoff to the first scheduled workout.

Behavioral basis: implementation intentions, context-dependent repetition, action planning, autonomy.

Mobbin precedents: Duolingo’s explicit daily-goal commitment; Runna’s schedule inputs and contextual reminder request; Scratch’s own activity grid.

Key screen to visualize: the editable weekly rhythm and backup plan summary.

Primary experiment metric: scheduled users completing a first workout. Guardrails: permission denial, schedule edits, and whether schedule fields are actually persisted before release.

## Variant D — Confidence Builder

Hypothesis: novice users will activate more often when onboarding normalizes uncertainty and proves competence before presenting a plan.

1. Reassure: “You don’t need to know gym jargon.” Allow `I already know the basics` to skip.
2. Choose confidence level and available equipment.
3. Learn one real interaction: exercise, weight, reps, complete set.
4. Explain rest/RPE only in context, with a recommended default.
5. Reveal a low-complexity starter plan with a concise rationale.
6. “You already know how to log it.” Start now or schedule later.

Behavioral basis: mastery, instruction, effort reinforcement, reduced task difficulty, competence support.

Mobbin precedents: Duolingo placement routing and low-anxiety tasks; Fitbod’s equipment matching; Headspace’s guided first session.

Key screen to visualize: the contextual coaching step immediately after a set is logged.

Primary experiment metric: tutorial completion followed by first independent set. Guardrails: experienced-user skip rate and perceived condescension.

## Variant E — Meet Me Where I Am

Hypothesis: routing by user intent will reduce mismatch and overall onboarding cost better than a single universal sequence.

1. Ask one high-information question: “How do you want to start?”
2. Branches:
   - `I have a plan` → enter/import the first workout day using the existing composer.
   - `Build one for me` → goal, equipment, frequency, recommendation.
   - `Just let me train` → empty workout or two-tap starter plan.
3. Every branch converges on Review → Activate → Home/Start Workout.
4. Account creation appears only after the user has something worth saving.

Behavioral basis: autonomy, choice architecture, progressive disclosure, preference-fit, Apple’s optional-onboarding guidance.

Mobbin precedents: Duolingo’s recommended-start versus placement split; Strava’s immediate activity action; Fitbod’s earned-value-before-account pattern.

Key screen to visualize: the intent router with three clearly differentiated starts.

Primary experiment metric: branch-specific activation and overall first workout within 72 hours. Guardrails: branch regret/backtracking and choice comprehension.

## Evidence and source hierarchy

- [Apple Human Interface Guidelines — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding): onboarding should be fast, optional, interactive, and defer nonessential setup and permissions.
- [Self-determination theory health intervention meta-analysis](https://pubmed.ncbi.nlm.nih.gov/32437175/): autonomy and perceived competence are plausible mechanisms for durable behavior change.
- [Exercise motivation systematic review](https://pubmed.ncbi.nlm.nih.gov/22726453/): competence satisfaction and intrinsic motives consistently relate to exercise participation.
- [Physical activity self-monitoring meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC8365685/): logging and feedback are core behavior-change candidates.
- [Implementation intentions review](https://pubmed.ncbi.nlm.nih.gov/31923898/): when/where/how planning is promising but depends on motivation, self-efficacy, control, and context.
- [Defaults meta-analysis](https://www.cambridge.org/core/journals/behavioural-public-policy/article/when-and-why-defaults-influence-decisions-a-metaanalysis-of-default-effects/67AF6972CFB52698A60B6BD94B70C2C0): defaults can strongly influence choice, with high variability; recommendations must be transparent and editable.
- [Choice overload meta-analysis](https://myscp.onlinelibrary.wiley.com/doi/full/10.1016/j.jcps.2014.08.002): overload depends on choice complexity, task difficulty, uncertainty, and the user’s decision goal.
- [Duolingo’s growth model](https://blog.duolingo.com/growth-model-duolingo/) and [growth principles](https://blog.duolingo.com/growth-principles/): the company runs extensive experiments, but these sources do not prove that any one visible onboarding flow is universally highest-converting.

## Mobbin flow references

- [Duolingo onboarding](https://mobbin.com/flows/b0b4f93f-5637-46ec-9d77-49ecda6b991d)
- [Runna onboarding](https://mobbin.com/flows/1689d6d5-e245-4369-9dae-320bd863136b)
- [Runna plan creation](https://mobbin.com/flows/e79ed9b7-9c4b-45b2-b08d-ed04346db5cc)
- [Fitbod onboarding](https://mobbin.com/flows/66d6670d-aebb-4e65-a90b-42b71cff135c)
- [Equinox+ program personalization](https://mobbin.com/flows/754cee5d-c1f4-44a7-9ae9-5e09474db3a3)
- [Tempo starting a plan](https://mobbin.com/flows/985e6fd9-9777-4644-8e79-05c8c75d1b20)
- [Headspace onboarding](https://mobbin.com/flows/7cdc08c0-3bcb-4882-90dd-5cf92019616f)
- [Fabulous onboarding](https://mobbin.com/flows/060e3fc0-5785-4ef6-9dc2-dd257a652797)
- [Strava onboarding](https://mobbin.com/flows/a1cc2697-2224-4e70-b255-75b38a1748d9)

## Claims intentionally excluded

No mockup should include invented user counts, star ratings, strength gains, completion uplift, scientific percentages, testimonials, or “X days to form a habit.” Shipped-app screens are pattern evidence, not proof of conversion. Scratch must establish uplift through its own experiments.
