# Scratch Product Context

Product: ScratchWorkout

Lane: iOS workout tracker. The product serves repeated strength training use: create reusable plans, start the next workout quickly, log sets with minimal friction, and finish with a clear sense of completion.

Current app posture:
- SwiftUI app based on the Scratch Figma file.
- Dark, sports-oriented visual system with Inter typography, black and charcoal surfaces, and a bright green accent.
- Main surfaces include Overview, Plans, Start Workout, Log Workout, Workout Complete, and guided plan creation.
- Navigation is tab-led with focused full-screen flows for workout and plan tasks.

Core job:
Help someone follow a training plan and log a workout without losing focus between sets.

Primary users:
- Lifters who train several days per week and want a simple plan-first tracker.
- People who want a fast phone workflow in the gym rather than a spreadsheet-like tool.
- Users who care about consistency, recent activity, and completing the planned work.

Product principles:
- Plans are reusable training objects, not one-off workout notes.
- The next action should be obvious on every screen.
- Logging should be thumb-friendly and fast, especially during an active workout.
- Progress should feel concrete through counts, completion, and recent activity before complex analytics.
- The app should feel athletic, focused, and tactile without becoming noisy.
- Copy should be short, direct, and training-native.

Feature focus:
- Overview: monthly workout count, activity heatmap, active plan, and next planned workout.
- Plans: active plan, saved plans, plan activation, and entry into plan creation.
- Plan creation: choose frequency, search exercises, configure sets/reps, review, and activate.
- Workout start: show the day and exercises before beginning.
- Workout logging: move exercise by exercise, log weight and reps, and complete the session.
- Workout completion: summarize duration, exercise count, and set count.

Implementation guardrails:
- Active implementation lives under `ScratchWorkout/`.
- Do not introduce separate app targets, duplicate product names, or alternate design systems unless explicitly requested.
- Prefer existing app types, colors, fonts, components, haptics, and navigation patterns.
- Keep root context files aligned with Scratch so future agents do not drift into older product assumptions.

Success criteria:
- A returning user can identify their next workout in seconds.
- Creating or activating a plan feels lightweight.
- Logging an exercise requires minimal attention and no visual hunting.
- Completion feels satisfying but compact.
- New work feels native to the Scratch visual language already in the app.
