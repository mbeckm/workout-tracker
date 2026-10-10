# App Store release guide (Trim 1.0)

State as of 10 October 2026 (first submission). Update the checkboxes when something changes.

## Identity

| | |
|---|---|
| App Store name | Trim Workout |
| App Store Connect app ID | 6805436799 |
| Bundle ID | `com.marvinbeckmann.ScratchWorkout` (widget: `.ExpoWidgetsTarget`) |
| Team | Marvin Beckmann (494ATHBZ74) |
| EAS project | `@mbeckms-team/workout-app` |
| Version | 1.0.0 (build numbers are managed remotely by EAS) |

## Ship the store build

```sh
cd mobile
npx eas-cli build --platform ios --profile production --auto-submit
```

- The `production` profile listens on the EAS channel `production`, so App Store hotfixes go out with `npx eas-cli update --channel production --platform ios --environment production`. Marvin's phone stays on `testflight-gadget` / `gadget`.
- Auto-submit uploads to App Store Connect with the API key stored on EAS. Apple processes the build in 10–30 minutes.
- Uploads need the iOS 26 SDK (Xcode 26) since 28 April 2026; the EAS image for Expo SDK 57 has it.

## Store listing

- Text lives in `mobile/store.config.json` (description, subtitle, keywords, promo text, review notes, contact, age-rating answers). `npx eas-cli metadata:lint` validates it; `npx eas-cli metadata:push` uploads it. Push deliberately.
- Screenshots, header and search assets: `design/app-store/` (see its README). The design source is the Paper file "Trim — App Store".
- Release is manual: after approval the version waits in Pending Developer Release until Marvin releases it.

## What App Review checks, and where Trim answers it

| Guideline | Answer |
|---|---|
| 2.1 completeness | No login; review notes walk every Pro gate and the 12-tap onboarding path. Sandbox prices load in the paywall. |
| 2.3 metadata | Description and screenshots show the current device app only; Pro skins are marked PRO; no prices in screenshots. |
| 3.1.2 subscriptions | Paywall: period label + price per card, trial timeline, renewal terms, Restore, Terms (Apple EULA), Privacy; the EULA and privacy links are also in the description. Prices time out to Try again after 15 s. |
| 5.1.1 / 5.1.2(i) data and third-party AI | Plan import asks "Read it with Claude?" (Allow / Read on iPhone) before anything is sent (decision 98). Privacy policy names Anthropic, Vercel, RevenueCat, PostHog. |

## Status

**Done**
- [x] Paid Apps agreement, banking and tax forms active.
- [x] Subscription group "Trim Pro": `…pro.yearly` $39.99 with a 1-week free trial, `…pro.monthly` $6.99.
- [x] RevenueCat: entitlement `Scratch Pro`, offering `default`; EAS `production` env has the RevenueCat and PostHog keys.
- [x] Age rating 9+ (Health or Wellness Topics).
- [x] App icon and splash.
- [x] Import consent prompt, paywall period labels, price timeout (QA passed in the Simulator on 10 October).
- [x] Privacy policy updated and deployed (10 October).
- [x] Store copy rewritten for the device app (`store.config.json`).
- [x] Screenshots 6.9" and 6.3" (7 frames), product page header 3840×1646, search asset 3840×2560, subscription review screenshot.
- [x] DSA: Marvin declares trader status with his own address.

**In App Store Connect before Submit for Review**
- [x] App Privacy: User Content → Photos or Videos and Other User Content → Photos or Videos and Other User Content are declared (App Functionality, not linked, no tracking) for plan import.
- [x] DSA: declared as trader for this app (App Information → Digital Services Act).
- [x] App Information → Regulated medical device: No (10 October).
- [x] `metadata:push` (10 October; needs `"version": "1.0"` in store.config.json), checked description, keywords, promo text, review notes, age rating.
- [x] Screenshots uploaded (the 6.3" set is the required size; App Store Connect scales it to the other iPhones). Header and search asset uploaded too.
- [x] Each subscription: review screenshot and review notes saved.
- [x] Both subscriptions and the Trim Pro group added to the same review submission as the version (each item's "Add for Review" → the existing draft).
- [x] Build 1.0.0 (17), `production` profile from main @ 14b5251, selected; content rights: no third-party content.
- [x] Submitted for review on 10 October 2026, 20:35 (4 items: app 1.0, yearly, monthly, group). Manual release.

**After approval**
- [ ] Release the version (Marvin).
- [ ] Asset Library: product page header and search asset (iOS 27 creative assets; reviewed separately).
- [ ] Featuring nomination: App Launch (Apple asks for 3+ weeks of lead time, so do it right after release for a later feature).
