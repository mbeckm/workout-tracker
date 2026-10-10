# App Store assets (Trim 1.0)

Made on 10 October 2026 in the Paper file "Trim — App Store", from real screens of the app in the iOS Simulator (iPhone 17 Pro Max, `EXPO_PUBLIC_HOME_DEMO=gadget-history`, status bar overridden to 9:41).

Direction: "The machine". Graphite ground (`#121211`), one Inter 800 claim per frame with an orange IBM Plex Mono kicker, and a real screen running large off the bottom edge. Every frame shows the app in use (guideline 2.3.3), with no prices (2.3.7), and the Pro skins are marked PRO.

| File | Caption |
|---|---|
| `screenshots/*/01-hero.png` | A gym log you can hold. (Home) |
| `02-log.png` | Turn. Press. Logged. |
| `03-rest.png` | Rest on the display. |
| `04-records.png` | Records print. (the receipt) |
| `05-skins.png` | Six machines. Pick yours. |
| `06-progress.png` | Every lift, going up. |
| `07-history.png` | Every week, on paper. |

- `screenshots/6.9/`: 1320×2868 (iPhone with Dynamic Island, large). `screenshots/6.3/`: 1206×2622 (medium). RGB PNG, no alpha.
- `creative/header-3840x1646.png`: product page header (21:9), the six machines. iOS 27 creative assets, uploaded in the Asset Library.
- `creative/search-3840x2560.png`: search results asset (3:2).
- `review/paywall-review-*.png`: the subscription review screenshot (the paywall with real prices).
- `raw/`: the untouched Simulator captures.

To redo a frame: rerun the Simulator capture, replace the image in the matching Paper artboard, export at 1x, convert to RGB.
