# Exercise art pipeline (offline)

Dot-matrix frames for the exercise sheet panel (D5). Generated offline, committed as assets; the
app never calls an image API. Work directories (sources, candidates, rejects) stay outside the
repo; only approved frames come in.

## Files

- `lifts.json`: every bundled row (`id`, `name`, `equipment`, `muscles`, `figure` kind, `frames`:
  2, or 3 for the few complex lifts). Built from `src/catalog/bundled.ts`.
- `poses/<group>.json`: the recipe per lift, one file per movement group (press, squat, hinge,
  pull, row, fly, curl, extension, raise, carry, plus legs, core and holds for rows with no SVG
  figure): `id`, `start`, `end`, `middle` (three-frame
  lifts only), `muscles` to light, optional `view` (default `side view`), `anchor` (`floor`, or
  `top` when the bar stays and the body moves, e.g. pull-ups) and `notes`.
- `approved.json`: the lifts Marvin approved (catalog id to frame count). The manifest is
  generated from it.

## Steps

1. `make.py poses/<group>.json <work-dir> --n 2 [--only id,id]` builds the prompt, asks Gemini
   (`generate.py`, gemini-3.1-flash-image) for a **two-up flat source** per candidate (three-up
   with a middle pose): the same faceless mannequin side by side on white, flat grey body
   `#9a9a9a`, dark grey equipment `#5a5a5a`, working muscles flat orange `#FF6A1A`, with
   `refs/two-up-squat.png` as the style reference. Both poses in one image keeps the body
   identical. Then `dots.py` converts each source and `sheet.py` writes
   `<work-dir>/<group>-sheet[-n].png` (source, then each frame on the lcd ground at 360 px).
2. Review every row against the rubric below. `loop.py` makes a looping GIF of picks.
3. `install.py <work-dir> <id>=c<n> ...` copies the approved candidates to
   `mobile/assets/images/exercise-art/<slug>-<i>.png`, records them in `approved.json` and
   regenerates `src/device/exercise-art.generated.ts`, which `src/device/exercise-art.tsx` plays.

`dots.py` splits the source at the emptiest columns, scales every frame with one shared scale,
lines up the anchor (feet on one baseline, or the bar), and renders transparent 120x80 dot
frames at 9 px pitch (1080x720), the figure about 64% of the panel height, centred, clear of
the top-left (the close button). `--long 1.3` (the default) caps the widest frame at 1.3x the
standing figure height, so lying lifts come out at the same body size as standing ones. About 10 KB a frame.

## Rubric

Same body in every frame; correct pose and equipment (bar path, grip, bench angle, machine
geometry); the right muscles lit; readable at 360 pt; no extra limbs; not clipped; feet (or the
bar) on one line.

## Auth

In the cloud the proxy credential adds the key; call with none. On a Mac export
`GEMINI_API_KEY` from `mobile/.env`. Never print or commit a key. `generate.py` retries 429, 5xx
and dropped connections.

## Learned

The model returns a white ground even when asked for black (handled in `dots.py`); separate
generations per pose give different bodies; a bar seen end-on reads as a blob, so ask for a
three-quarter view of the barbell; plates in front of the head hide it; thin cables break into
stray dots, so ask for thick ones; calf and tibialis raises move a few dots of foot and don't read.
