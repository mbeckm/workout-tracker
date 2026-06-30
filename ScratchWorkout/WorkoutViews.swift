import SwiftUI

struct StartWorkoutView: View {
    var day: WorkoutDay
    var onStart: () -> Void

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                Text("Start Workout")
                    .font(AppFont.display)
                    .padding(.top, 70)

                HStack(alignment: .firstTextBaseline) {
                    SectionTitle(text: day.title)
                    Spacer()
                    Text("\(day.exercises.count) Exercises")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                }
                .padding(.top, 24)

                VStack(spacing: 12) {
                    ForEach(Array(day.exercises.prefix(5))) { exercise in
                        ExerciseCard(exercise: exercise)
                    }
                }
                .padding(.top, 12)

                Spacer(minLength: 24)

                HStack {
                    Spacer()
                    CTAButton(title: "Start Workout", width: 312, action: onStart)
                    Spacer()
                }
                .padding(.bottom, 106)
            }
            .padding(.horizontal, 24)
        }
    }
}

struct LogWorkoutView: View {
    var exercise: ExercisePrescription
    var onComplete: ([LoggedSet]) -> Void

    @State private var weight = 85
    @State private var reps = 12
    @State private var activeStep = 1
    @State private var sets: [LoggedSet]

    init(exercise: ExercisePrescription, onComplete: @escaping ([LoggedSet]) -> Void) {
        self.exercise = exercise
        self.onComplete = onComplete
        _reps = State(initialValue: exercise.reps)
        _sets = State(initialValue: Self.initialSets(for: exercise))
    }

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                StepProgress(count: 5, active: activeStep, width: 48, spacing: 24)
                    .padding(.top, 70)

                SectionTitle(text: exercise.name)
                    .padding(.top, 24)

                SetTable(sets: sets)
                    .padding(.top, 12)

                Spacer(minLength: 0)

                VStack(alignment: .center, spacing: 16) {
                    NumberStepper(label: "Weight", value: $weight, minimum: 0, maximum: 300)
                    NumberStepper(label: "Reps", value: $reps, minimum: 1, maximum: 50)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 16)

                HStack {
                    Spacer()
                    CTAButton(title: "Log", width: 312) {
                        logSet()
                    }
                    Spacer()
                }
                .padding(.bottom, 106)
            }
            .padding(.horizontal, 24)
        }
    }

    private func logSet() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.78)) {
            if let nextIndex = sets.firstIndex(where: { $0.weight == nil }) {
                sets[nextIndex].weight = weight
                sets[nextIndex].reps = reps
                activeStep = min(5, activeStep + 1)
            } else {
                onComplete(sets)
            }
        }
    }

    private static func initialSets(for exercise: ExercisePrescription) -> [LoggedSet] {
        (1...exercise.sets).map { index in
            switch index {
            case 1:
                LoggedSet(index: index, weight: 85, reps: exercise.reps)
            case 2:
                LoggedSet(index: index, weight: 85, reps: max(1, exercise.reps - 2))
            default:
                LoggedSet(index: index, weight: nil, reps: nil)
            }
        }
    }
}

private struct SetTable: View {
    var sets: [LoggedSet]

    var body: some View {
        CardShell(height: 168, cornerRadius: 12, fill: AppColor.surface2) {
            Grid(alignment: .leading, horizontalSpacing: 8, verticalSpacing: 8) {
                GridRow {
                    header("Set")
                    header("kg")
                    header("Reps")
                }

                ForEach(sets) { set in
                    GridRow {
                        cell("\(set.index)", isEmpty: set.weight == nil)
                        cell(set.weight.map(String.init) ?? "-", isEmpty: set.weight == nil)
                        cell(set.reps.map(String.init) ?? "-", isEmpty: set.reps == nil)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 9)
        }
    }

    private func header(_ text: String) -> some View {
        Text(text)
            .font(AppFont.label)
            .foregroundStyle(AppColor.secondaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func cell(_ text: String, isEmpty: Bool) -> some View {
        Text(text)
            .font(AppFont.label)
            .foregroundStyle(isEmpty ? AppColor.tertiaryText : AppColor.primaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct WorkoutCompleteView: View {
    var workout: LoggedWorkout?
    var onFinish: () -> Void

    var body: some View {
        AppScreen {
            VStack(spacing: 0) {
                Text("Well done!")
                    .font(AppFont.display)
                    .padding(.top, 70)

                VStack(spacing: 17) {
                    ZStack {
                        Circle()
                            .fill(AppColor.accent)
                            .frame(width: 100, height: 100)

                        Image(systemName: "checkmark")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundStyle(AppColor.base)
                    }
                    .frame(width: 120, height: 120)

                    SummaryCard(workout: workout)
                }
                .padding(.top, 48)
                .padding(.horizontal, 24)

                Spacer(minLength: 24)

                CTAButton(title: "Finish", width: 312, action: onFinish)
                    .padding(.bottom, 106)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

private struct SummaryCard: View {
    var workout: LoggedWorkout?

    var body: some View {
        VStack(spacing: 24) {
            summary(value: durationText, label: "Duration")
            divider
            summary(value: "\(workout?.exerciseCount ?? 8)", label: "Exercises")
            divider
            summary(value: "\(workout?.setCount ?? 32)", label: "Sets")
        }
        .padding(.vertical, 16)
        .frame(width: 354, height: 310)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }

    private var durationText: String {
        guard let minutes = workout?.durationMinutes else {
            return "1h 33min"
        }

        return "\(minutes / 60)h \(minutes % 60)min"
    }

    private func summary(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(AppFont.display)
                .tracking(-0.64)
            Text(label)
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle()
            .fill(AppColor.border)
            .frame(height: 1)
            .frame(width: 338)
    }
}
