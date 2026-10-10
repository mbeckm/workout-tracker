# App Store release guide (Trim 1.0)

State as of 27 September 2026. Update the checkboxes when something changes.

## Identity

| | |
|---|---|
| App Store name | Trim Workout |
| App Store Connect app ID | 6805436799 |
| Bundle ID | `com.marvinbeckmann.ScratchWorkout` (widget: `.ExpoWidgetsTarget`) |
| Team | Marvin Beckmann (494ATHBZ74) |
| EAS project | `@mbeckms-team/workout-app` |
| Version | 1.0.0 (build numbers are managed remotely by EAS) |

## Ship a build to TestFlight

```sh
cd mobile
npx eas-cli build --platform ios --profile production --auto-submit
```

- Asks for the Apple ID sign-in and a two-factor code on first use; credentials are stored on EAS afterwards.
- Builds in Expo's cloud, then uploads to App Store Connect (`submit.production.ios.ascAppId` in `eas.json`).
- Apple processes the build in 10–30 minutes. It is then available to the internal group "Team (Expo)". Internal testing needs no review.
- Production env on EAS: `EXPO_PUBLIC_REVENUECAT_API_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`; `eas.json` pins the exercise media/search flags off.

### Or: build locally and upload with Transporter

No EAS build minutes or queue. First used for 1.0.0 (15) on 9 October 2026.

1. **Worktree.** `git worktree add --detach <scratch>/release origin/main`, then `npm ci` in its `mobile/`. Keeps the shared `mobile/ios` untouched.
2. **Env.** `npx eas-cli env:pull --environment production --path .env.local`, then add the `eas.json` production `env` lines (`EXPO_PUBLIC_EXERCISE_MEDIA=off`, `EXPO_PUBLIC_EXERCISE_REMOTE_SEARCH=off`, `EXPO_PUBLIC_PROGRESS_DEMO=0`). The pulled file has no trailing newline, so check that the first added line didn't join the last key. Delete `.env.local` after the build.
3. **Prebuild.** CocoaPods on `PATH` and `LANG`/`LC_ALL=en_US.UTF-8`, then `npx expo prebuild --platform ios`.
4. **Build number and channel** (EAS normally sets both). Use the next number after `npx eas-cli build:version:get -p ios -e production`:
   - `CFBundleVersion` in `ios/Trim/Info.plist` and `ios/ExpoWidgetsTarget/Info.plist`, and `CURRENT_PROJECT_VERSION` in `project.pbxproj`.
   - In `ios/Trim/Supporting/Expo.plist`, add `EXUpdatesRequestHeaders` → `expo-channel-name` = `gadget` (tester builds) or `production` (App Store).
5. **Archive.** `xcodebuild -workspace Trim.xcworkspace -scheme Trim -configuration Release -destination 'generic/platform=iOS' -archivePath <out>.xcarchive -allowProvisioningUpdates DEVELOPMENT_TEAM=494ATHBZ74 CODE_SIGN_STYLE=Automatic archive`.
6. **Export.** `xcodebuild -exportArchive` with an ExportOptions.plist (`method` `app-store-connect`, `destination` `export`, `signingStyle` `automatic`, team `494ATHBZ74`). Signing uses Xcode's Apple ID account and a cloud-managed distribution certificate, so no certificate is needed in the keychain.
7. **Check the app** in the archive: `Expo.plist` has the channel, `EXUpdates.bundle/fingerprint` matches the runtime of the latest EAS build (or else old OTA updates won't apply), and `ITSAppUsesNonExemptEncryption` is `false`.
8. **Upload.** `open -a Transporter Trim.ipa`, then Deliver.
9. **Sync EAS.** Set the EAS remote build number to the number you used, or the next EAS build collides. `build:version:set` only takes interactive input; `expect` can type it.
10. **App Store Connect → TestFlight → build.** Fill in *Was soll getestet werden?*, then Gruppe ＋ → Beta testers → Zur Prüfung übermitteln. Later 1.0.0 builds were approved for external testing right away.

Store listing text lives in `mobile/store.config.json`. `npx eas-cli metadata:lint` validates it; `npx eas-cli metadata:push` uploads it to App Store Connect. Only push deliberately.

## Status

**Done**
- [x] Paid Apps agreement, banking and tax forms active.
- [x] Subscription group "Trim Pro": `…pro.yearly` $39.99 with a 1-week free trial (all countries), `…pro.monthly` $6.99. US base price, other countries set by Apple. English display names and descriptions.
- [x] RevenueCat: entitlement `Scratch Pro` with both products; current offering `default` (`$rc_annual`, `$rc_monthly`); in-app purchase key valid.
- [x] App Privacy published: Identifiers → User ID (App Functionality, Analytics), Purchases → Purchase History (App Functionality), Usage Data → Product Interaction (Analytics). None linked to the user, none used for tracking. Privacy policy URL https://scratch-legal.vercel.app/privacy (names RevenueCat and PostHog).
- [x] Age rating 9+ (Health or Wellness Topics: Yes).
- [x] App icon and splash ("Trim" mark).
- [x] TestFlight build 1.0.0 (2) processed and available internally.
- [x] 1.0.0 (15), built locally and uploaded with Transporter (9 October 2026), is in TestFlight for Team (Expo) and Beta testers (8 testers). Channel `gadget`.

**Before submitting 1.0 for review**
- [ ] Review screenshot for each subscription (the paywall with real prices).
- [ ] Attach both subscriptions to version 1.0 (Version page → In-App Purchases and Subscriptions).
- [ ] Declare whether Trim is a regulated medical device (App Information; expected answer: No).
- [ ] iPhone screenshots (6.9", and 6.5" if required): Home with a plan, log screen with last time and rest, Done, Progress, Plans. No prices.
- [ ] `npx eas-cli metadata:push`, then check description, keywords, review notes and age rating in App Store Connect.
- [ ] Select the build on the 1.0 version page.

**Device QA (on TestFlight)**
- [ ] Purchases: yearly with trial, monthly, restore, manage subscription from Settings, cancel.
- [ ] Paywall with the real intro offer: trial timeline, "Start 7-day free trial", terms text.
- [ ] Native context menus (plan rows, day rows, History rows) and delete confirmations.
- [ ] Keyboard docking on the log screen and in the check-in sheet.
- [ ] Kill the app mid-workout: the workout and the Live Activity resume; the Live Activity ends on Finish or Cancel.
- [ ] Large Dynamic Type and dark mode on every tab.
- [ ] PostHog shows the session's events; no workout contents in any event.
