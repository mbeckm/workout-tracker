"""Generate candidates for one pose file and build its contact sheet.

Usage: make.py <poses/group.json> <work-dir> [--n 2] [--only id,id]

A pose file is a list of {"id", "start", "end", "middle"?, "muscles", "view"?, "anchor"?,
"notes"?}: `id` from lifts.json, one line per pose, the working muscles to light. For each lift
it asks Gemini for `--n` sources (two-up, or three-up with a middle pose), converts each with
dots.py and adds a row per candidate to <work-dir>/<group>-sheet.png. The work dir stays out of
the repo; install.py copies the approved candidates in.
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "refs", "two-up-squat.png")
poses_path, work = sys.argv[1], sys.argv[2]
n = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 2
only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
group = os.path.splitext(os.path.basename(poses_path))[0]
lifts = {l["id"]: l for l in json.load(open(os.path.join(HERE, "lifts.json")))}
poses = [p for p in json.load(open(poses_path)) if not only or p["id"] in only]
os.makedirs(os.path.join(work, "src"), exist_ok=True)
os.makedirs(os.path.join(work, "frames"), exist_ok=True)

def prompt(p):
    lift = lifts[p["id"]]
    three = "middle" in p
    count, places = ("THREE", "LEFT, MIDDLE and RIGHT") if three else ("TWICE", "LEFT and RIGHT")
    poses = [f"LEFT figure (start): {p['start']}"]
    if three:
        poses.append(f"MIDDLE figure: {p['middle']}")
    poses.append(f"RIGHT figure (end): {p['end']}")
    return " ".join([
        f"Flat vector illustration on a pure white background. The SAME faceless mannequin drawn {count}",
        f"side by side ({places}), same size, same body proportions, seen from the same angle",
        f"({p.get('view', 'side view')}), all on the same ground line, with clear empty white space",
        "between the figures so they never touch or overlap.",
        f"Exercise: {lift['name']} ({lift['equipment'] or 'no equipment'}).",
        *poses,
        p.get("notes", ""),
        "Style exactly like the reference image: flat colours only, no shading, no gradients, no",
        "outlines, no text, no labels, no arrows, no shadows, no floor line. Body flat mid grey #9a9a9a",
        "with a smooth faceless head. All equipment (bars, plates, dumbbells, kettlebells, benches,",
        "machines, cables, handles, frames) flat dark grey #5a5a5a, drawn solid and simple.",
        f"Working muscles flat orange #FF6A1A: {p['muscles']}. Everything else grey.",
        "Each figure complete and uncropped, two arms and two legs, no extra limbs.",
    ])

def job(args):
    p, c = args
    slug = p["id"].removeprefix("bundled-")
    src = os.path.join(work, "src", f"{slug}-c{c}.png")
    frames = [os.path.join(work, "frames", f"{slug}-c{c}-{i}.png") for i in range(3 if "middle" in p else 2)]
    if not os.path.exists(src):
        r = subprocess.run([sys.executable, os.path.join(HERE, "generate.py"), src,
                            "21:9" if "middle" in p else "16:9", prompt(p), REF], capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip()[-300:], flush=True)
    if os.path.exists(src):
        r = subprocess.run([sys.executable, os.path.join(HERE, "dots.py"), src, *frames,
                            "--anchor", p.get("anchor", "floor")], capture_output=True, text=True)
        if r.returncode:
            print(slug, c, "dots failed:", r.stderr.strip()[-300:], flush=True)
    return f"{lifts[p['id']]['name']}  c{c}  ({slug})|{src}|" + "|".join(frames)

with ThreadPoolExecutor(4) as pool:
    rows = list(pool.map(job, [(p, c) for p in poses for c in range(n)]))
PAGE = 10
for i in range(0, len(rows), PAGE):
    page = f"-{i // PAGE + 1}" if len(rows) > PAGE else ""
    subprocess.run([sys.executable, os.path.join(HERE, "sheet.py"), os.path.join(work, f"{group}-sheet{page}.png"),
                    *rows[i:i + PAGE]])
