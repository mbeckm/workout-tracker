# Exercise art pipeline (offline)

Dot-matrix frames for the exercise sheet panel. Generated offline, committed as assets; the app
never calls an image API.

1. `generate.py` asks Gemini for a **two-up flat source**: the same faceless mannequin drawn twice
   (start left, end right) on white, flat grey body, dark grey equipment, working muscles flat
   orange `#FF6A1A`. Pass `refs/two-up-squat.png` as the style reference. Generating both poses
   in one image is what keeps the body identical across frames.
2. `dots.py` splits it, scales both halves with one scale, aligns the feet, and renders
   transparent dot frames (120x80, pitch 9, 1080x720).
3. Frames go in `mobile/assets/images/exercise-art/`, played by `src/device/exercise-art.tsx`.

Learned: the model returns a white ground even when asked for black (handled in `dots.py`);
separate generations per pose give different bodies; keep the figure about 64% of the panel
height and clear of the top-left (the close button).
