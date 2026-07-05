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
        .accessibilityLabel("Account")
    }

    private var iconName: String {
        switch session {
        case .loading:
            "hourglass"
        case .signedOut:
            "person.crop.circle"
        case .signedIn:
            syncState == .syncing ? "arrow.triangle.2.circlepath" : "checkmark.circle.fill"
        }
    }

    private var label: String {
        switch session {
        case .loading:
            "Account"
        case .signedOut:
            "Sign in"
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
        .alert("Account", isPresented: alertBinding) {
            Button("OK", role: .cancel) {
                controller.alertMessage = nil
                controller.authError = nil
            }
        } message: {
            Text(controller.alertMessage ?? controller.authError?.localizedDescription ?? "")
        }
        .confirmationDialog("Delete account?", isPresented: $isConfirmingDeletion, titleVisibility: .visible) {
            Button("Delete Account", role: .destructive) {
                Task {
                    await controller.deleteAccount()
                }
            }

            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the account session and saved account workout data for this preview backend.")
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 16) {
            Text("Account")
                .font(AppFont.display)
                .lineLimit(1)

            Spacer(minLength: 12)

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
            .accessibilityLabel("Close account")
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
        case .signedIn(let user):
            signedInContent(user)
        }
    }

    private var signedOutContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sign in")
                .font(AppFont.h1)

            Text("Save plans and logged workouts to your account.")
                .font(AppFont.body)
                .foregroundStyle(AppColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 12) {
                providerButton(.apple)
                providerButton(.google)
            }
            .padding(.top, 8)
        }
    }

    private func signedInContent(_ user: AccountUser) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if controller.pendingMigration != nil {
                migrationPrompt
            }

            accountCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text(user.displayName)
                        .font(AppFont.h1)
                        .lineLimit(1)

                    accountDetail(label: "Provider", value: user.provider.title)

                    if let email = user.email {
                        accountDetail(label: "Email", value: email)
                    }

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

            Button {
                Task {
                    await controller.signOut()
                }
            } label: {
                accountActionLabel(title: "Sign Out", foreground: AppColor.primaryText, fill: AppColor.surface1)
            }
            .buttonStyle(.plain)
            .disabled(controller.isWorking)

            Button {
                isConfirmingDeletion = true
            } label: {
                accountActionLabel(title: "Delete Account", foreground: Color(hex: 0xFF6B6B), fill: AppColor.surface1)
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

                Text("Your account has no saved workout data yet. Upload plans and history from this device?")
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

    private func providerButton(_ provider: AccountProvider) -> some View {
        Button {
            Task {
                await controller.signIn(with: provider, snapshot: currentSnapshot)
            }
        } label: {
            HStack(spacing: 12) {
                providerGlyph(provider)
                    .frame(width: 28, height: 28)

                Text(provider.buttonTitle)
                    .font(AppFont.subheading)
                    .lineLimit(1)

                Spacer(minLength: 12)

                if controller.isWorking {
                    ProgressView()
                        .tint(AppColor.primaryText)
                }
            }
            .foregroundStyle(provider == .apple ? AppColor.base : AppColor.primaryText)
            .padding(.horizontal, 16)
            .frame(height: 56)
            .background(provider == .apple ? AppColor.primaryText : AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(provider == .apple ? Color.clear : AppColor.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(controller.isWorking)
        .accessibilityLabel(provider.buttonTitle)
    }

    @ViewBuilder
    private func providerGlyph(_ provider: AccountProvider) -> some View {
        switch provider {
        case .apple:
            Image(systemName: "apple.logo")
                .font(.system(size: 22, weight: .semibold))
        case .google:
            Text("G")
                .font(.system(size: 20, weight: .bold, design: .rounded))
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
