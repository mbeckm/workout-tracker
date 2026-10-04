# App Store Privacy Answer Worksheet

Prepared for the current ScratchWorkout Release configuration. Re-audit before every submission and whenever accounts, a remote exercise provider, analytics, crash reporting, advertising, or payments are added.

## Recommended current answer

**Data Collection:** “No, we do not collect data from this app.”

Reasoning:

- Local workout data never leaves the device unless the user has iCloud available.
- The optional remote snapshot is stored in the user’s private CloudKit database. Apple states that private database content is owned by the user and is not visible in the developer portal.
- Apple defines collection as off-device transmission that lets the developer or a third-party partner access data beyond servicing a real-time request. The developer does not operate a backend or receive the private CloudKit payload.
- Apple says developers are not responsible for disclosing data collected by Apple through Apple frameworks/services, while any data the developer obtains from those services must still be declared.
- Release builds use the built-in exercise catalog, so search queries are not sent to ExerciseDB.
- There are no analytics, advertising, crash-reporting, or tracking SDKs.

Authoritative references:

- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple CloudKit private database documentation](https://developer.apple.com/documentation/cloudkit/ckcontainer/privateclouddatabase)
- [Apple User Privacy and Data Use](https://developer.apple.com/app-store/user-privacy-and-data-use/)

## Required URLs

- **Privacy Policy URL:** required for iOS. Publish `PRIVACY_POLICY.md` at a public HTTPS URL.
- **User Privacy Choices URL:** optional. It may point to the same page if that page explains local deletion and **Delete iCloud Data**.

## Tracking

- Tracking: **No**
- App Tracking Transparency prompt: **Not used**
- Advertising identifier: **Not accessed**

## Payment change checklist

Before adding StoreKit products:

1. Re-check whether Purchase History is available to the developer or associated with any future app account/backend.
2. Do not declare Payment Info when payment is entered outside the app and the developer never receives it; Apple explicitly lists that case as not collected.
3. Update the privacy policy with subscription management, retention, and deletion behavior.
4. Re-publish App Store privacy answers before submitting the payment-enabled build.

## Changes that invalidate the current “No data collected” answer

- A developer-operated Supabase/Firebase/custom backend.
- Apple/Google/email application accounts.
- Remote exercise search in Release if the provider retains queries, IP addresses, or logs.
- Third-party analytics, attribution, advertising, crash reporting, or support SDKs.
- Server-side subscription validation tied to a user or device identifier.
