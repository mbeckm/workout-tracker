"""Generate one image with a Gemini image model.

Usage: generate.py <out.png> <aspect> <prompt> [ref.png ...]

Auth: in the cloud environment the proxy credential adds the x-goog-api-key header, so nothing
is needed. On a Mac, export GEMINI_API_KEY (it lives in mobile/.env, never commit it). Retries
429 and 5xx with backoff. Model: gemini-3.1-flash-image.
"""
import base64, json, subprocess, sys, tempfile, os, time

out, aspect, prompt, *refs = sys.argv[1:]
parts = [{"text": prompt}]
for r in refs:
    mime = "image/jpeg" if r.lower().endswith((".jpg", ".jpeg")) else "image/png"
    parts.append({"inlineData": {"mimeType": mime, "data": base64.b64encode(open(r, "rb").read()).decode()}})
body = {"contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
    json.dump(body, f)
headers = ["-H", "Content-Type: application/json"]
if os.environ.get("GEMINI_API_KEY"):
    headers += ["-H", "x-goog-api-key: " + os.environ["GEMINI_API_KEY"]]
for attempt in range(5):
    res = subprocess.run(["curl", "-sS", "--max-time", "240", *headers,
                          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
                          "-d", "@" + f.name], capture_output=True, text=True)
    d = json.loads(res.stdout)
    code = d.get("error", {}).get("code")
    if code in (429, 500, 502, 503, 504):
        time.sleep(2 ** (attempt + 1) * 5); continue
    break
os.unlink(f.name)
if "error" in d:
    print(out, "ERROR", d["error"].get("code"), d["error"].get("message", "")[:200]); sys.exit(1)
for p in d["candidates"][0]["content"]["parts"]:
    if "inlineData" in p:
        open(out, "wb").write(base64.b64decode(p["inlineData"]["data"])); print("saved", out); break
else:
    print(out, "NO IMAGE", json.dumps(d)[:300])
