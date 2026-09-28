// Web smoke test for cloud sessions (Linux, no iOS Simulator).
// Loads routes from a static web export in headless Chromium, saves an iPhone-sized
// screenshot per route and fails on uncaught page errors. iOS-native pieces (SwiftUI,
// glass, SF Symbols, sheets) render differently or not at all on web: use this to catch
// crashes and broken flows, not to judge look and feel.
//
//   npx expo export --platform web --output-dir /tmp/trim-web
//   node scripts/web-smoke.mjs /tmp/trim-web [route ...]   # default route: /
//
// Screenshots go to <export dir>/_smoke/.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const [dir, ...args] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node scripts/web-smoke.mjs <export dir> [route ...]');
  process.exit(2);
}
const routes = args.length ? args : ['/'];
const outDir = path.join(dir, '_smoke');
mkdirSync(outDir, { recursive: true });

// Playwright is preinstalled globally in cloud sessions; it is not a project dependency.
const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = createRequire(path.join(globalRoot, 'noop.js'))('playwright');

const port = 8099;
const server = spawn('npx', ['--yes', 'serve', '-s', dir, '-l', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));

const browser = await chromium.launch();
let failed = false;
try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const file = path.join(outDir, `${route.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`);
    await page.screenshot({ path: file });
    console.log(`${errors.length ? 'FAIL' : 'ok  '} ${route} → ${file}`);
    for (const e of errors) console.log(`     ${e}`);
    failed ||= errors.length > 0;
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
