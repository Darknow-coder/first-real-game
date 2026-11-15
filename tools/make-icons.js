// Renders the app icons (PNG) from the game's own crystal renderer.
// Requires Playwright (npx playwright install chromium) — dev tool only.
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
}
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await page.route('http://flocon.local/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  const file = join(ROOT, path);
  route.fulfill({ body: await readFile(file), contentType: TYPES[extname(file)] || 'application/octet-stream' });
});
for (const [name, query] of [
  ['icon-192.png', 'size=192'],
  ['icon-512.png', 'size=512'],
  ['icon-maskable-512.png', 'size=512&maskable'],
]) {
  await page.goto(`http://flocon.local/tools/icon.html?${query}`);
  await page.waitForFunction(() => document.title === 'ready');
  const data = await page.evaluate(() => window.__png);
  await writeFile(join(ROOT, 'www/icons', name), Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
