# Trim (mobile app)

The Trim iPhone app: Expo + Expo Router, TypeScript. Repo-level docs live one folder up: `../AGENTS.md` (build, run, conventions), `../PRODUCT.md` and `../APP_STORE_RELEASE_GUIDE.md`.

```sh
npm install
npx expo run:ios            # dev build into the Simulator
npx expo start --dev-client # Metro for an installed dev build
npx tsc --noEmit            # typecheck
```

| Path | What it holds |
|---|---|
| `src/app/` | Routes (Expo Router) |
| `src/screens/` | Screen components |
| `src/components/` | Shared UI |
| `src/domain/` | Pure logic: sets, progress, targets, plan loop |
| `src/store/` | App state and local persistence |
| `src/purchases/` | RevenueCat, paywall, Pro gates |
| `src/analytics/` | Anonymous PostHog events |
| `src/catalog/` | Bundled exercise catalog and starter templates |
| `widgets/` | Live Activity |
| `plugins/` | Local Expo config plugins |
| `assets/trim.icon` | Layered iOS app icon |

Environment variables: see `.env.example`.
