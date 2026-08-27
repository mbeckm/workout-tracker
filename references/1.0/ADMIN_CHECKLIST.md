# App Store commerce checklist (human)

Agents cannot sign Apple agreements or create banking records. Do these yourself while the app is built.

## Today

- [ ] App Store Connect → Agreements, Tax, and Banking → Paid Applications agreement
- [ ] Tax forms and banking for IAP
- [ ] Create the app record (iPhone, Health & Fitness, bundle ID matching `mobile/app.json`)
- [ ] Subscription group: monthly + annual + lifetime (same product IDs in App Store Connect and RevenueCat)
- [x] RevenueCat public iOS SDK key is in `mobile/.env` as `EXPO_PUBLIC_REVENUECAT_API_KEY` (gitignored)
- [x] RevenueCat entitlement identifier is `Scratch Pro` (matches `PRO_ENTITLEMENT` in the app)
- [ ] App Store Connect products must use the same product IDs as RevenueCat
- [ ] Cursor → MCP → Expo server authenticated (`https://mcp.expo.dev/mcp`) — done if tools work
- [ ] Host a live privacy policy URL
- [ ] Host terms of use (required for subscriptions)
- [ ] Host a support URL / contact email

## Before submit (target 27 Aug)

- [ ] Sandbox Apple ID can buy and restore the yearly plan
- [ ] App Privacy questionnaire matches RevenueCat + local storage
- [ ] Age rating questionnaire
- [ ] 1024 icon without alpha
- [ ] 6.9-inch screenshots from the real app (not Mobbin)
- [ ] Review notes: how to complete a workout, that IAP uses sandbox, restore purchases location

EAS project: `88024391-8ffd-4a6d-923d-18c766972365`
