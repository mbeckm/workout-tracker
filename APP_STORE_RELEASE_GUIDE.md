# App Store Release Guide for ScratchWorkout

This guide is tailored to the active app in this repository.

Current project facts:

- Active Xcode project: `ScratchWorkout.xcodeproj`
- Scheme: `ScratchWorkout`
- App target: iPhone only
- Bundle identifier: `com.marvinbeckmann.ScratchWorkout`
- Apple development team set in the project: `494ATHBZ74`
- Marketing version: `1.0`
- Build number: `1`
- Storage today: local `UserDefaults` persistence for workout data
- Exercise search provider: free OSS ExerciseDB API at `https://oss.exercisedb.dev`
- Current permissions found in source: no HealthKit, location, camera, photos, notifications, accounts, or analytics
- Privacy manifest: `ScratchWorkout/PrivacyInfo.xcprivacy` is included in the app target for UserDefaults required-reason API usage
- Current app icon state: an `AppIcon.appiconset` exists, but it only has `Contents.json`; a real 1024 x 1024 app icon image still needs to be added

Workspace note: the repository root is the project root. Treat `ScratchWorkout.xcodeproj` and the `ScratchWorkout/` source folder as the release candidate.

## Best Release Path

Use this sequence:

1. Install on your own iPhone from Xcode for personal testing.
2. Upload to TestFlight and invite friends.
3. After friend testing, submit the same app to public App Store review.

TestFlight is the sweet spot for your immediate goal because it lets friends use the app before the public App Store page is live.

## Phase 1: Apple Account Setup

1. Make sure you have an Apple Account with two-factor authentication enabled.
2. Join the Apple Developer Program.
   - A free Apple developer account can run the app on your own devices from Xcode.
   - App Store distribution and proper TestFlight distribution require the paid Apple Developer Program.
   - Apple lists the standard membership as 99 USD per year.
3. Decide whether to enroll as an individual or organization.
   - Individual: the App Store developer name is your personal name.
   - Organization: the App Store developer name is the legal company name, and Apple requires organization verification such as a D-U-N-S number.
4. Sign in to App Store Connect.
5. In App Store Connect, accept any latest agreements in the Business section. Apple will not let you create or submit apps until required agreements are signed.
6. If the app will be paid, include subscriptions, or include in-app purchases later, complete tax and banking setup. For a free first release, this can usually stay simple, but still check whether App Store Connect asks for compliance details.

Official links:

- [Apple Developer Program](https://developer.apple.com/programs/)
- [Choosing a Membership](https://developer.apple.com/support/compare-memberships/)
- [App Store Connect](https://appstoreconnect.apple.com/)

## Phase 2: Decide the Public Product Identity

Before creating the App Store record, decide the name and identity you actually want friends and the public to see.

Recommended choices for this app:

- App Store name: `Scratch Workout Tracker` or a final branded name you prefer
- Bundle ID: keep `com.marvinbeckmann.ScratchWorkout` if this is only a personal/friends release; change it before first App Store upload if you want a more final brand identity
- SKU: `scratch-workout-ios-2026`
- Primary language: English
- Category: Health & Fitness
- Price: Free for the first release

Do this before upload because the bundle ID and uploaded build must match the app record in App Store Connect.

## Phase 3: Prepare the Xcode Project

Open `ScratchWorkout.xcodeproj` in Xcode.

1. Select the `ScratchWorkout` project in the navigator.
2. Select the `ScratchWorkout` target.
3. Go to Signing & Capabilities.
4. Confirm Team is your paid Apple Developer Program team.
5. Confirm Bundle Identifier is final.
6. Confirm Automatically manage signing is enabled unless you have a reason to manage profiles manually.
7. Go to General.
8. Confirm Version is `1.0`.
9. Confirm Build is `1` for the first upload. Every new upload for the same version needs a higher build number.
10. Confirm supported devices are what you want. The project is currently iPhone only.
11. Confirm deployment target. The project currently uses iOS 17.0.

Then fix release blockers:

1. Add a real app icon.
   - Add a 1024 x 1024 PNG to `ScratchWorkout/Assets.xcassets/AppIcon.appiconset`.
   - Make sure the asset catalog references the image.
   - Avoid transparency for the App Store icon.
2. Review the included privacy manifest.
   - This app uses `UserDefaults`, which Apple includes in the required-reason API area.
   - `PrivacyInfo.xcprivacy` is already included in the app target and declares UserDefaults reason `CA92.1`.
   - Verify the reason against Apple's current required-reason API list before final submission.
3. Make sure there is no placeholder content.
4. Make sure first launch is useful even with no data.
5. Review the ExerciseDB provider decision before public release.
   - The current free API is suitable for prototype/start usage.
   - The provider documents non-commercial use, attribution, and strict rate limits.
   - Keep the in-app AscendAPI attribution unless a paid/provider agreement says otherwise.
   - Do not ship a commercial/App Store release on this provider path until usage rights are confirmed.
6. Test the complete flow:
   - Create a plan
   - Search for and add provider-backed exercises
   - Start or activate a plan
   - Log workout data
   - Close and reopen the app
   - Confirm saved workout data persists
   - Try empty states
   - Try small and large text sizes
   - Try light/dark behavior if supported

Example privacy manifest shape if UserDefaults remains the only required-reason API:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

Official links:

- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

## Phase 4: Prepare App Store Materials

You need these before public submission, and most are also useful for TestFlight.

### Required or Strongly Recommended Assets

1. App icon.
2. App screenshots.
   - For an iPhone-only app, start with 6.9-inch iPhone screenshots.
   - Apple accepts 6.9-inch portrait screenshots such as 1260 x 2736, 1290 x 2796, or 1320 x 2868 pixels.
   - If the UI is the same across device sizes, App Store Connect can scale high-resolution screenshots down.
3. Support URL.
   - A simple page with contact email is enough.
4. Privacy policy URL.
   - Required for iOS apps, even if the app does not collect data.
5. App description.
6. Subtitle.
7. Keywords.
8. Review notes for Apple.

Official links:

- [Upload screenshots and app previews](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- [Add an app icon](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/)

### Screenshot Set

Recommended first screenshot flow:

1. Home/dashboard with active training state.
2. Plan creation screen.
3. Workout logging screen.
4. Progress or history screen.
5. A polished empty or first-use state, only if it looks good and explains value visually.

Keep screenshots honest. Apple expects metadata and screenshots to reflect the real app experience.

### Draft App Store Metadata

Use this as a starting point.

App name:

```text
Scratch Workout Tracker
```

Subtitle:

```text
Fast strength plans and logging
```

Promotional text:

```text
Build simple workout plans, log sets quickly, and keep your training history close.
```

Description:

```text
Scratch Workout Tracker is a focused strength training log for people who want fast plan creation and quick workout tracking without a noisy fitness feed.

Create reusable plans, organize exercises, log sets, and keep your recent workout history on your iPhone. The app is designed for repeated gym use, with clear workout cards, quick interactions, and a compact flow that stays out of the way while you train.

Features:
- Create reusable workout plans
- Track exercises, sets, reps, and weight
- Keep workout data saved locally on your device
- Review recent training history
- Use a fast, iPhone-native interface built for the gym

Scratch Workout Tracker is not medical advice and does not diagnose, treat, or prescribe training programs. Train responsibly and consult a qualified professional before starting a new exercise program if needed.
```

Keywords:

```text
workout,strength,gym,fitness,training,sets,reps,tracker,logging,plans
```

Review notes:

```text
No account is required. The reviewer can create a workout plan, add exercises, log sets, and reopen the app to verify local persistence. Workout data is stored locally on device. The app does not currently use HealthKit, location, camera, notifications, analytics, or a backend service.
```

Support URL page should include:

- App name
- Contact email
- Short support statement
- Privacy policy link

Privacy policy should say, for the current app:

- Workout entries are stored locally on the user's device.
- The app does not require an account.
- The app does not transmit workout data to a server.
- Exercise search terms are sent to the ExerciseDB/AscendAPI provider to return exercise suggestions.
- Provider exercise metadata may include exercise names, target muscles, equipment, body parts, instructions, and GIF media URLs.
- The app does not use third-party analytics or advertising SDKs.
- Users can delete app data by deleting the app, unless you add an in-app reset option.

If you add analytics, accounts, cloud sync, HealthKit, ads, crash reporting, or subscriptions later, update this policy and App Store privacy answers.

## Phase 5: Create the App Record in App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com/).
2. Go to Apps.
3. Click the plus button.
4. Choose New App.
5. Select iOS.
6. Enter the final app name.
7. Choose the primary language.
8. Pick the bundle ID that matches Xcode.
9. Enter the SKU.
10. Choose full user access unless you are managing a larger team.
11. Click Create.

Apple's note: you cannot add an app record until the Account Holder signs the latest required agreement.

Official link:

- [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app)

## Phase 6: Upload the First Build

In Xcode:

1. Open `ScratchWorkout.xcodeproj`.
2. Select the `ScratchWorkout` scheme.
3. Select Any iOS Device or a connected physical iPhone as the run destination.
4. Choose Product > Clean Build Folder.
5. Choose Product > Archive.
6. When the Organizer opens, select the archive.
7. Click Validate App.
8. Resolve any signing, icon, privacy, or metadata warnings.
9. Click Distribute App.
10. Choose App Store Connect.
11. Upload the build for TestFlight and App Store distribution.
12. Wait for App Store Connect processing. Apple sends an email when processing finishes.

Important upload behavior:

- The uploaded build is matched to App Store Connect using the bundle ID and version.
- The build number uniquely identifies each upload.
- If you upload again for version `1.0`, increment Build from `1` to `2`, then `3`, and so on.

Official link:

- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

## Phase 7: TestFlight for You and Friends

### Internal Testing

Use this first if your Apple Developer account has other users.

1. In App Store Connect, open the app.
2. Go to TestFlight.
3. Add internal testers.
4. Add the processed build.
5. Install through the TestFlight app.
6. Test the full app on a real iPhone.

### External Testing for Friends

External testers are the right route for friends who are not App Store Connect users.

1. In App Store Connect, open the app.
2. Go to TestFlight.
3. Create an internal group first if App Store Connect asks for it.
4. Under External Testing, create a new group, for example `Friends Beta`.
5. Add the build to the group.
6. Fill in What to Test.
7. Submit the build for TestFlight App Review.
8. After approval, invite friends by email or public invitation link.

Apple allows up to 10,000 external testers per app. The first external TestFlight build usually receives a fuller review; later builds for the same version may be faster. Apple also limits TestFlight App Review submissions to up to six builds in a 24-hour period.

Suggested What to Test:

```text
Please create a workout plan, add exercises, log a few sets, close and reopen the app, and check that the saved workout data still appears. Please send feedback if anything feels confusing, slow, or broken during a normal gym session.
```

Message to friends:

```text
I am testing my iPhone workout tracker on TestFlight. The app lets you create workout plans and log sets. If you want to try it, install Apple's TestFlight app, open this invite link, and send me anything that feels broken or confusing.
```

Official link:

- [Invite external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)

## Phase 8: Fill Out App Store Connect for Public Release

In the app's App Store tab, complete:

1. App information.
   - Name
   - Subtitle
   - Category: Health & Fitness
   - Content rights
2. Pricing and availability.
   - Set price to Free unless you are ready for paid distribution.
   - Choose countries and regions.
3. App privacy.
   - For the current source, if the app truly stores workout data only locally and sends nothing off-device, answer that the app does not collect data.
   - If any SDK or service is added, update this answer.
4. Privacy policy URL.
5. Age rating.
   - The current app likely fits a low age rating, but answer the questionnaire honestly.
6. Screenshots.
7. Build selection.
8. App Review contact information.
9. Review notes.
10. Release option.
    - Recommended for first launch: manually release after approval.

Official links:

- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Set age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)
- [Overview of publishing your app](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/overview-of-publishing-your-app-on-the-app-store/)
- [Select a release option](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)

## Phase 9: Submit for App Review

1. In App Store Connect, open the app.
2. Select the version you want to submit.
3. Confirm the correct build is selected.
4. Click Add for Review.
5. Open the draft submission.
6. Click Submit for Review.
7. Watch the app status:
   - Waiting for Review
   - In Review
   - Accepted, Rejected, or Metadata Rejected
8. If Apple sends a rejection or question, respond clearly in App Review messages.
9. If approved and you chose manual release, click Release This Version.

Apple says an approved app can take up to 24 hours to appear on the App Store after release.

Official links:

- [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## Common Rejection Risks for This App

1. Missing app icon image.
   - The asset catalog exists, but the real image is not currently present.
2. Privacy mismatch.
   - If the app says it collects no data, do not include analytics, ads, remote logging, or crash SDKs without updating App Privacy.
3. Provider terms mismatch.
   - The current free ExerciseDB API documents non-commercial use, attribution, and strict rate limits. Confirm rights before public/commercial release.
4. Missing privacy policy URL.
   - Required for iOS apps.
5. App feels unfinished.
   - Apple can reject apps that crash, contain placeholder content, or have obvious broken flows.
6. Metadata overpromises.
   - Do not claim AI coaching, medical benefits, HealthKit sync, or advanced progress analytics unless the build actually includes those features.
7. Beta language in public App Store metadata.
   - Use TestFlight for beta testing. The public App Store submission should be a complete app.
8. Fitness safety claims.
   - Keep the app positioned as a workout logger, not medical advice or injury prevention.

## Release-Day Checklist

Before the first TestFlight upload:

- [ ] Apple Developer Program membership is active.
- [ ] App Store Connect agreements are signed.
- [ ] Final app name chosen.
- [ ] Final bundle ID chosen.
- [ ] Xcode signing team selected.
- [ ] Real 1024 x 1024 app icon added.
- [ ] `PrivacyInfo.xcprivacy` reviewed and added if required.
- [ ] App runs on your iPhone.
- [ ] Create plan flow works.
- [ ] Exercise search works online.
- [ ] Exercise search fallback behavior works offline or when provider calls fail.
- [ ] AscendAPI exercise data attribution is visible.
- [ ] Workout logging flow works.
- [ ] Data persists after app restart.
- [ ] Build number is ready for upload.

Before inviting friends:

- [ ] Build uploaded and processed.
- [ ] TestFlight internal install works on your phone.
- [ ] External test group created.
- [ ] What to Test text added.
- [ ] TestFlight App Review approved.
- [ ] Friend invite link or emails ready.
- [ ] At least one friend can search for and add an ExerciseDB-backed exercise.

Before public App Store submission:

- [ ] Privacy policy URL is live.
- [ ] Support URL is live.
- [ ] Screenshots uploaded.
- [ ] Description, subtitle, keywords, and category are filled out.
- [ ] App privacy answers are published.
- [ ] ExerciseDB provider usage rights, attribution, and rate limits are cleared for the intended release.
- [ ] Age rating completed.
- [ ] Pricing and availability completed.
- [ ] Correct build selected.
- [ ] Review notes explain that no login is required.
- [ ] Manual release selected for first launch.

## Simple Timeline

Fastest realistic path:

1. Today: fix icon/privacy manifest, test on your iPhone, create app record.
2. Same day or next day: upload build to App Store Connect.
3. Same day or next day: run internal TestFlight.
4. After TestFlight review: invite friends.
5. After friend feedback: submit public App Store version.
6. After App Review approval: manually release.

The main things that can slow this down are Apple Developer enrollment, signing/profile issues, missing App Store metadata, missing privacy details, and review feedback.

## After Launch

For every update:

1. Fix or add features locally.
2. Increment build number.
3. Upload to TestFlight.
4. Test internally.
5. Invite friends if useful.
6. Create a new App Store version if public metadata or screenshots need changes.
7. Submit the update.
8. Release manually or use phased release.

Keep the privacy policy and App Store privacy answers updated whenever data handling changes.
