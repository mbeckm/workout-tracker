# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

- Single product: **ScratchWorkout**, a native **iOS / SwiftUI** workout tracker.
- Active Xcode project: `ScratchWorkout.xcodeproj` (scheme `ScratchWorkout`, iPhone-only, `IPHONEOS_DEPLOYMENT_TARGET = 17.0`, Swift 5.0).
- App source lives in `ScratchWorkout/`. Root `*.md` files (`PRODUCT.md`, `DESIGN.md`, `MOBBIN_RESEARCH.md`, `APP_STORE_RELEASE_GUIDE.md`) are product/design context only.

### Build/run/test cannot happen on the Cloud Agent (Linux) VM

- The Cloud Agent VM is **Linux x86_64**. This app requires **macOS + Xcode + an iOS 17 Simulator (or a physical iPhone)** and cannot be built or run here.
- The sources depend on Apple-only frameworks (`SwiftUI`, `Charts`, `Combine`) that are not available in the open-source Swift-for-Linux toolchain, so even a partial Linux compile/typecheck is not meaningful. Do not attempt to install a Swift toolchain to "build" the app on Linux.
- There are **no third-party dependencies** (no Swift Package Manager, CocoaPods, or Carthage — no `Package.swift`, `Package.resolved`, `Podfile`, or `Cartfile`) and **no dependency-install step**. The update script is intentionally a no-op.

### How to build/run/test (on macOS with Xcode)

- Open in Xcode: `open ScratchWorkout.xcodeproj`, then Run (Cmd+R) against an iPhone simulator.
- Command-line build:
  `xcodebuild -project ScratchWorkout.xcodeproj -scheme ScratchWorkout -destination 'platform=iOS Simulator,name=iPhone 15' build`
- Tests: the project currently has no test target; there is no `xcodebuild test` scheme configured.

### Runtime/behavior notes

- Persistence is local `UserDefaults` (JSON snapshots); there is no backend, database, or server to run. Auth/cloud sync are stubbed locally (`LocalPreviewAuthService`, `LocalPreviewWorkoutRepository` in `AccountServices.swift`).
- Exercise search uses the public OSS ExerciseDB API (`https://oss.exercisedb.dev`), overridable via the `EXERCISE_CATALOG_BASE_URL` env var or the `ExerciseCatalogBaseURL` Info.plist key. It is optional: failures fall back to on-disk cache and then a built-in seed catalog, so all core flows work offline.
