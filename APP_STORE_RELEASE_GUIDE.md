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
