# Trim

A plan-first iPhone workout logger. Build your week once, then just press Start. Published on the App Store as **Trim Workout**.

| Folder | What it is |
|---|---|
| `mobile/` | The app: Expo + Expo Router, TypeScript |
| `legal/` | Support and privacy pages, deployed to https://scratch-legal.vercel.app |
| `.cursor/skills/` | Project skills: `trim-ui` (visual rules) and `implement-screen` |
| `.agents/skills/` | Official Expo skills |

## Start here

- `AGENTS.md`: how the repo works, how to build and run, and the names that must not change.
- `PRODUCT.md`: what Trim is and how it behaves.
- `PRODUCT-DECISIONS.md`: decisions that changed the product.
- `APP_STORE_RELEASE_GUIDE.md`: App Store Connect, RevenueCat and TestFlight.

## Run it

```sh
cd mobile
npm install
npx expo run:ios
```

Requires macOS, Xcode and the iOS Simulator.
