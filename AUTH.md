# ScratchWorkout Accounts & Cloud Persistence

## Product decision

ScratchWorkout v1 does **not** create a separate application account and does not require a login. The workout tracker remains fully usable with local persistence. When the device has an available iCloud account, the app uses the user's private CloudKit database to back up and synchronize plans, custom exercises, workout history, and progression state.

This replaces the earlier Supabase + Apple/Google SSO direction. That architecture was technically viable, but it added provider setup, backend operations, account deletion/revocation, more personal-data processing, and an avoidable onboarding gate. It was not required to achieve the actual v1 goal: surviving reinstall and moving workout history between Apple devices.

StoreKit purchases and subscriptions do not require a ScratchWorkout account. A separate identity system can be introduced later only if the product needs cross-platform access, web access, coaching/social features, or server-owned entitlements.

Release builds also use the built-in offline exercise catalog. The non-commercial OSS ExerciseDB endpoint is enabled only for Debug development builds, preventing a future paid/subscription release from silently violating that provider's usage restrictions.

## User experience

- Workouts save locally whether or not iCloud is available.
- With iCloud available, the account sheet becomes an **iCloud Sync** screen.
- On the first iCloud connection, the user confirms uploading existing local data.
- On launch, the newest snapshot wins. A newer offline local snapshot is pushed instead of being overwritten by older cloud data.
- Failed cloud writes leave the local workout data intact and surface a retry state.
- “Delete iCloud Data” removes only the remote ScratchWorkout backup; it never deletes the user's Apple Account or local workouts.
- Without iCloud, the screen explains that storage is local and links to Settings.

## Implementation boundaries

| Concern | Implementation |
|---|---|
| Local source of truth | `WorkoutStore` / `UserDefaults` snapshot |
| Cloud account detection | `ICloudAccountService` / `CKContainer.accountStatus` |
| Private remote storage | `CloudKitWorkoutRepository` / private CloudKit database |
| Migration | `RepositoryMigrationCoordinator` uploads and verifies the first snapshot |
| Conflict policy | Compare persisted `lastModifiedAt` with remote `capturedAt`; newest snapshot wins |
| Write-through | Existing save events in `RootView` enqueue cloud sync |
| Cloud deletion | `AccountController.deleteCloudData(localSnapshot:)` |
| UI | `AccountView` and `AccountEntryButton` |

The core workout, plan, navigation, and logging views remain independent from CloudKit.

## External Apple setup required

Before a signed TestFlight/App Store build can use CloudKit:

1. Enroll the team in the Apple Developer Program (a Personal Team cannot ship to the App Store).
2. In Certificates, Identifiers & Profiles, enable iCloud/CloudKit for `com.marvinbeckmann.ScratchWorkout`.
3. Create or attach the container `iCloud.com.marvinbeckmann.ScratchWorkout`.
4. Keep Xcode automatic signing enabled and refresh provisioning profiles.
5. In CloudKit Console, deploy the development schema containing the `WorkoutSnapshot` record type to production before App Store review.
6. Test with two devices using the same iCloud account, plus an offline/reconnect pass.

The CloudKit entitlements are present in the Release configuration. Debug builds deliberately use `LOCAL_ONLY_BUILD` with empty entitlements so they can run on a free Personal Team and in Simulator without crashing. Cloud behavior must therefore be verified with a signed physical-device Release/TestFlight build after the paid App ID and container are provisioned.

## Privacy and App Store implications

- There is no application account creation, so Apple's in-app **account deletion** rule does not apply to v1.
- The app should still link a privacy policy and accurately disclose workout data stored via iCloud.
- App Review notes should state that the app works without login and that optional sync uses the review device's iCloud account.
- If a separate account system is added later, restore in-app account deletion, provider revocation, privacy disclosures, and a reviewable demo path before release.

## Previous work retained

The earlier auth hardening pass remains useful: protocol seams, observable session/sync state, migration verification, remote-to-local hydration, coalesced write-through sync, and error UI. The production composition now injects iCloud-backed implementations. Obsolete OAuth configuration, Keychain token storage, provider buttons, and preview authentication were removed; an injectable local repository remains available as a test seam.
