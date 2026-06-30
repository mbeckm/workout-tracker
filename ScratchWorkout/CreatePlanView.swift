import SwiftUI

struct CreatePlanView: View {
    enum Stage: String {
        case frequency
        case search
        case configureSets
        case configureReps
        case dayReview
        case finalReview
        case activatePrompt
    }

    var onFinish: (WorkoutPlan, Bool) -> Void

    @Namespace private var searchNamespace
    @FocusState private var searchFocused: Bool
    @State private var stage: Stage = .frequency
    @State private var daysPerWeek = 3
    @State private var searchQuery = ""
    @State private var configuredSets = 3
    @State private var configuredReps = 12
    @State private var selectedExercise = "Incline Bench Press"

    var body: some View {
        AppScreen {
            ZStack(alignment: .topLeading) {
                baseContent

                if stage == .activatePrompt {
                    activationPrompt
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding(.horizontal, 24)
        }
        .onChange(of: searchFocused) { _, focused in
            if focused && stage == .search && searchQuery.isEmpty {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    searchQuery = "Inclin"
                }
            }
        }
    }

    @ViewBuilder
    private var baseContent: some View {
        switch stage {
        case .frequency:
            frequencyView
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
        case .search:
            searchView
                .transition(.opacity.combined(with: .move(edge: .trailing)))
        case .configureSets:
            configureView(title: "Number of sets", value: $configuredSets, activeSteps: 1) {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    stage = .configureReps
                }
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        case .configureReps:
            configureView(title: "Number of reps", value: $configuredReps, activeSteps: 1) {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    stage = .dayReview
                }
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        case .dayReview:
            dayReviewView
                .transition(.opacity.combined(with: .move(edge: .trailing)))
        case .finalReview, .activatePrompt:
            finalReviewView
                .transition(.opacity.combined(with: .move(edge: .trailing)))
        }
    }

    private var frequencyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create Plan")
                .font(AppFont.display)
                .padding(.top, 66)

            VStack(spacing: 16) {
                HStack(spacing: 24) {
                    RoundStepButton(symbol: "minus") {
                        daysPerWeek = max(1, daysPerWeek - 1)
                    }

                    Text("\(daysPerWeek)")
                        .font(.custom("Inter", size: 128, relativeTo: .largeTitle).weight(.bold))
                        .frame(width: 92, height: 105)
                        .contentTransition(.numericText())

                    RoundStepButton(symbol: "plus") {
                        daysPerWeek = min(7, daysPerWeek + 1)
                    }
                }

                Text("Workouts per week")
                    .font(AppFont.h1)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 257)
            .contentShape(Rectangle())
            .onTapGesture {
                Haptics.tap(.medium)
                withAnimation(.spring(response: 0.46, dampingFraction: 0.82)) {
                    stage = .search
                }
            }

            Spacer(minLength: 278)
        }
    }

    private var searchView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create Plan")
                .font(AppFont.display)
                .padding(.top, 66)

            StepProgress(count: 3, active: 1, width: 90, spacing: 45)
                .padding(.top, 24)

            SectionTitle(text: "Day 1")
                .padding(.top, 24)

            Spacer(minLength: 0)

            SearchSurface(
                query: $searchQuery,
                focused: $searchFocused,
                namespace: searchNamespace,
                suggestions: suggestions,
                onSelect: { exercise in
                    selectedExercise = exercise.replacingOccurrences(of: " (Dumbbells)", with: "")
                    Haptics.tap(.medium)
                    withAnimation(.spring(response: 0.44, dampingFraction: 0.82)) {
                        searchFocused = false
                        stage = .configureSets
                    }
                }
            )
            .padding(.bottom, 106)
        }
    }

    private func configureView(title: String, value: Binding<Int>, activeSteps: Int, onConfirm: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create Plan")
                .font(AppFont.display)
                .padding(.top, 66)

            StepProgress(count: 3, active: activeSteps, width: 90, spacing: 45)
                .padding(.top, 24)

            SectionTitle(text: "Day 1")
                .padding(.top, 24)

            Spacer(minLength: 0)

            ExerciseConfigCard(exercise: selectedExercise, label: title, value: value, onConfirm: onConfirm)
                .padding(.bottom, 106)
        }
    }

    private var dayReviewView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create Plan")
                .font(AppFont.display)
                .padding(.top, 66)

            StepProgress(count: 3, active: 1, width: 90, spacing: 45)
                .padding(.top, 24)

            SectionTitle(text: "Day 1")
                .padding(.top, 24)

            VStack(spacing: 12) {
                ForEach(SampleData.legExercises) { exercise in
                    ExerciseCard(exercise: exercise)
                }
            }
            .padding(.top, 12)

            Spacer(minLength: 24)

            Button {
                Haptics.tap(.medium)
                withAnimation(.spring(response: 0.46, dampingFraction: 0.84)) {
                    stage = .finalReview
                }
            } label: {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(AppColor.surface1)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(AppColor.border, lineWidth: 1)
                    )
                    .frame(height: 48)
            }
            .buttonStyle(.plain)
            .padding(.bottom, 106)
        }
    }

    private var finalReviewView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Review")
                .font(AppFont.display)
                .padding(.top, 66)

            StepProgress(count: 3, active: 3, width: 90, spacing: 45)
                .padding(.top, 24)

            SectionTitle(text: "Day 3")
                .padding(.top, 25)

            VStack(spacing: 12) {
                ForEach((stage == .activatePrompt ? Array(SampleData.pullExercises.prefix(3)) : SampleData.pullExercises)) { exercise in
                    ExerciseCard(exercise: exercise)
                }
            }
            .padding(.top, 12)

            Spacer(minLength: 24)

            if stage == .finalReview {
                HStack {
                    Spacer()
                    CTAButton(title: "Save Plan", width: 294) {
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            stage = .activatePrompt
                        }
                    }
                    Spacer()
                }
                .padding(.bottom, 106)
            } else {
                Spacer()
                    .frame(height: 188)
            }
        }
    }

    private var activationPrompt: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Mark plan as active?")
                    .font(AppFont.subheading)
                Text("Your active workout plan is shown on your home screen.")
                    .font(AppFont.body)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                Button {
                    finish(activate: false)
                } label: {
                    Text("Save to plans")
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.primaryText)
                        .frame(width: 113, height: 45)
                        .background(AppColor.border, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    finish(activate: true)
                } label: {
                    Text("Save & activate")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.base)
                        .frame(width: 127, height: 45)
                        .background(AppColor.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(24)
        .frame(width: 350)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .offset(x: 2, y: 589)
        .zIndex(4)
    }

    private var suggestions: [String] {
        guard !searchQuery.isEmpty else { return [] }
        return [
            "Incline Bench Press (Dumbbells)",
            "Incline Bicep Curls",
            "Incline Bench Press (Barbell)"
        ]
    }

    private func finish(activate: Bool) {
        Haptics.tap(.medium)
        let plan = WorkoutPlan(
            name: "PPL",
            daysPerWeek: daysPerWeek,
            createdAt: "30.06.26",
            days: [
                WorkoutDay(title: "Legs", exercises: SampleData.legExercises),
                WorkoutDay(title: "Pull", exercises: SampleData.pullExercises),
                WorkoutDay(title: "Push", exercises: SampleData.pushExercises)
            ]
        )
        onFinish(plan, activate)
    }
}

private struct SearchSurface: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding
    var namespace: Namespace.ID
    var suggestions: [String]
    var onSelect: (String) -> Void

    var body: some View {
        Group {
            if suggestions.isEmpty {
                fieldOnly
            } else {
                expanded
            }
        }
        .animation(.spring(response: 0.44, dampingFraction: 0.84), value: suggestions.isEmpty)
    }

    private var fieldOnly: some View {
        searchField
            .matchedGeometryEffect(id: "search-field", in: namespace)
            .frame(height: 54)
    }

    private var expanded: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(suggestions, id: \.self) { suggestion in
                    Button {
                        onSelect(suggestion)
                    } label: {
                        Text(suggestion)
                            .font(AppFont.subheading)
                            .foregroundStyle(AppColor.primaryText)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .frame(height: 306)

            searchField
                .matchedGeometryEffect(id: "search-field", in: namespace)
                .frame(height: 54)
        }
        .frame(height: 360)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private var searchField: some View {
        HStack {
            TextField("Search to add an exercise", text: $query)
                .focused(focused)
                .font(AppFont.body)
                .tint(AppColor.accent)
                .foregroundStyle(AppColor.primaryText)
                .submitLabel(.search)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }
}

private struct ExerciseConfigCard: View {
    var exercise: String
    var label: String
    @Binding var value: Int
    var onConfirm: () -> Void

    var body: some View {
        CardShell(height: 153, cornerRadius: 12, fill: AppColor.surface1) {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(exercise)
                        .font(AppFont.subheading)
                        .lineLimit(1)
                    Text(label)
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                }

                HStack(alignment: .center) {
                    HStack(spacing: 16) {
                        RoundStepButton(symbol: "minus") {
                            value = max(1, value - 1)
                        }

                        Text("\(value)")
                            .font(AppFont.display)
                            .frame(width: 42)
                            .contentTransition(.numericText())

                        RoundStepButton(symbol: "plus") {
                            value = min(30, value + 1)
                        }
                    }

                    Spacer()

                    Button {
                        Haptics.tap(.medium)
                        onConfirm()
                    } label: {
                        Image(systemName: "checkmark")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(AppColor.base)
                            .frame(width: 45, height: 45)
                            .background(AppColor.accent, in: Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
