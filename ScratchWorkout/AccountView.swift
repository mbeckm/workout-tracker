import SwiftUI

struct AccountEntryButton: View {
    var session: AuthSession
    var syncState: AccountSyncState
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap(.medium)
            action()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: iconName)
                    .font(.system(size: 15, weight: .semibold))

                Text(label)
                    .font(AppFont.label)
                    .lineLimit(1)
            }
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 12)
            .frame(height: 38)
            .background(AppColor.surface1, in: Capsule())
            .overlay(
                Capsule()
                    .stroke(borderColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("iCloud Sync")
    }

    private var iconName: String {
        switch session {
        case .loading:
            "hourglass"
        case .signedOut:
            "icloud.slash"
        case .signedIn:
            syncState == .syncing ? "arrow.triangle.2.circlepath" : "checkmark.circle.fill"
        }
    }

    private var label: String {
        switch session {
        case .loading:
            "Account"
        case .signedOut:
            "Local"
        case .signedIn:
            syncState.label
        }
    }

    private var foregroundColor: Color {
        switch session {
        case .signedIn:
            if case .failed = syncState {
                return AppColor.primaryText
            }

            return AppColor.accent
        case .loading, .signedOut:
            return AppColor.primaryText
        }
    }

    private var borderColor: Color {
        switch session {
        case .signedIn:
            AppColor.accent.opacity(0.55)
        case .loading, .signedOut:
            AppColor.border
        }
    }
}

struct AccountView: View {
    @ObservedObject var controller: AccountController
    var currentSnapshot: WorkoutCloudSnapshot

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirmingDeletion = false
    @State private var isPrivacyNoticePresented = false

    var body: some View {
        AppScreen {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    header

                    content
                        .padding(.top, 28)

                    Spacer(minLength: 40)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
        .presentationDetents([.large])
        .sheet(isPresented: $isPrivacyNoticePresented) {
            PrivacyNoticeView()
                .preferredColorScheme(.dark)
        }
        .alert("Account", isPresented: alertBinding) {
            Button("OK", role: .cancel) {
                controller.alertMessage = nil
                controller.authError = nil
            }
        } message: {
            Text(controller.alertMessage ?? controller.authError?.localizedDescription ?? "")
        }
        .confirmationDialog("Delete iCloud data?", isPresented: $isConfirmingDeletion, titleVisibility: .visible) {
            Button("Delete iCloud Data", role: .destructive) {
                Task {
                    await controller.deleteCloudData(localSnapshot: currentSnapshot)
                }
            }

            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This deletes ScratchWorkout's backup from iCloud. Workouts saved on this iPhone remain available.")
        }
    }

    private var header: some View {
        ScreenTitleBar(title: "iCloud Sync") {
            Button {
                Haptics.tap()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(AppColor.primaryText)
                    .frame(width: 42, height: 42)
                    .background(AppColor.surface1, in: Circle())
                    .overlay(
                        Circle()
                            .stroke(AppColor.border, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close iCloud Sync")
        }
        .padding(.top, 42)
    }

    @ViewBuilder
    private var content: some View {
        switch controller.session {
        case .loading:
            accountCard {
                HStack(spacing: 12) {
                    ProgressView()
                        .tint(AppColor.accent)

                    Text("Checking account")
                        .font(AppFont.subheading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .signedOut:
            signedOutContent
        case .signedIn:
            signedInContent
        }
    }

    private var signedOutContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Saved on this iPhone")
                .font(AppFont.h1)

            Text("Your workouts are safe locally. Sign in to iCloud in Settings to back them up and keep them in sync across your Apple devices.")
                .font(AppFont.body)
                .foregroundStyle(AppColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)

            Text("To enable sync, open the Settings app and sign in to your Apple Account. ScratchWorkout will detect iCloud the next time it opens.")
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)

            privacySection
                .padding(.top, 8)
        }
    }

    private var signedInContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            if controller.pendingMigration != nil {
                migrationPrompt
            }

            accountCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("iCloud Sync")
                        .font(AppFont.h1)
                        .lineLimit(1)

                    accountDetail(label: "Storage", value: "Private iCloud")
                    accountDetail(label: "Status", value: controller.syncState.label)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task {
                    await controller.sync(snapshot: currentSnapshot, reason: .manual)
                }
            } label: {
                accountActionLabel(
                    title: controller.isWorking ? "Syncing" : "Sync Now",
                    foreground: AppColor.base,
                    fill: AppColor.accent,
                    strokeWidth: 0
                )
            }
            .buttonStyle(.plain)
            .disabled(controller.isWorking)

            privacySection

            Button {
                isConfirmingDeletion = true
            } label: {
                accountActionLabel(title: "Delete iCloud Data", foreground: Color(hex: 0xFF6B6B), fill: AppColor.surface1)
            }
            .buttonStyle(.plain)
            .disabled(controller.isWorking)
        }
    }

    private var migrationPrompt: some View {
        accountCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Sync this device?")
                    .font(AppFont.subheading)

                Text("No ScratchWorkout backup exists in iCloud yet. Upload the plans and history from this iPhone?")
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)

                Button {
                    Task {
                        await controller.confirmMigration()
                    }
                } label: {
                    accountActionLabel(
                        title: controller.isWorking ? "Syncing" : "Sync This Device's Data",
                        foreground: AppColor.base,
                        fill: AppColor.accent,
                        strokeWidth: 0
                    )
                }
                .buttonStyle(.plain)
                .disabled(controller.isWorking)

                Button {
                    controller.dismissMigration()
                } label: {
                    accountActionLabel(title: "Not Now", foreground: AppColor.primaryText, fill: AppColor.surface1)
                }
                .buttonStyle(.plain)
                .disabled(controller.isWorking)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func accountDetail(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)

            Spacer(minLength: 12)

            Text(value)
                .font(AppFont.label)
                .foregroundStyle(AppColor.primaryText)
                .lineLimit(1)
        }
    }

    private var privacySection: some View {
        accountCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Privacy & Data")
                    .font(AppFont.subheading)

                Text("Workout data stays on this iPhone. With iCloud Sync, an encrypted backup is stored in your private iCloud database.")
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)

                Button("Read Privacy Details") {
                    isPrivacyNoticePresented = true
                }
                .font(AppFont.label)
                .foregroundStyle(AppColor.accent)
                .buttonStyle(.plain)
                .accessibilityHint("Opens the ScratchWorkout privacy notice")
            }
        }
    }

    private func accountActionLabel(title: String, foreground: Color, fill: Color, strokeWidth: CGFloat = 1) -> some View {
        Text(title)
            .font(AppFont.subheading)
            .foregroundStyle(foreground)
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppColor.border, lineWidth: strokeWidth)
            )
    }

    private func accountCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppColor.border, lineWidth: 1)
            )
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { controller.alertMessage != nil },
            set: { isPresented in
                if !isPresented {
                    controller.alertMessage = nil
                }
            }
        )
    }
}

private struct PrivacyNoticeView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppScreen {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 24) {
                    ScreenTitleBar(title: "Privacy") {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(AppColor.primaryText)
                                .frame(width: 42, height: 42)
                                .background(AppColor.surface1, in: Circle())
                                .overlay(Circle().stroke(AppColor.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Close privacy details")
                    }

                    privacyBlock(
                        title: "Workout data",
                        text: "Plans, exercises, logged sets, and workout history are saved locally on this iPhone. ScratchWorkout does not require a separate account."
                    )

                    privacyBlock(
                        title: "iCloud Sync",
                        text: "If iCloud is available, ScratchWorkout stores an encrypted workout snapshot in your private iCloud database so your data can be restored on your Apple devices. You can delete that cloud copy from the iCloud Sync screen without deleting local workouts."
                    )

                    privacyBlock(
                        title: "Exercise search",
                        text: "App Store builds use the built-in exercise catalog and do not send exercise searches to a third-party service."
                    )

                    privacyBlock(
                        title: "Analytics and advertising",
                        text: "ScratchWorkout does not include third-party analytics or advertising SDKs."
                    )
                }
                .padding(.horizontal, 24)
                .padding(.top, 42)
                .padding(.bottom, 40)
            }
        }
        .presentationDetents([.large])
    }

    private func privacyBlock(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(AppFont.subheading)

            Text(text)
                .font(AppFont.body)
                .foregroundStyle(AppColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
