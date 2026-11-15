// End-to-end smoke test in Chromium with mobile emulation (Playwright).
// Usage: npm run e2e   (starts its own static server)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  try {
    playwright = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
  } catch {
    console.error('Playwright is not installed: npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}

const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://localhost:${PORT}/`;
const server = spawn(process.execPath, [fileURLToPath(new URL('../../tools/serve.js', import.meta.url)), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(['ok', name]);
  } catch (err) {
    results.push(['FAIL', `${name}: ${err.message.split('\n')[0]}`]);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await playwright.chromium.launch();
const errors = [];
async function newPage(query) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__flocon && window.__flocon.state === 'title');
  return page;
}

await check('first launch goes straight into the first night, steering works', async () => {
  const page = await newPage('?reset');
  await page.mouse.click(195, 600);
  await page.waitForFunction(() => window.__flocon.state === 'play', null, { timeout: 5000 });
  assert(await page.locator('#hud').isVisible(), 'HUD visible');
  const x0 = await page.evaluate(() => window.__flocon.world.flake.x);
  await page.mouse.move(200, 600);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(200 - i * 9, 600);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const x1 = await page.evaluate(() => window.__flocon.world.flake.x);
  assert(x1 < x0 - 40, `flake moved left (${x0.toFixed(0)} -> ${x1.toFixed(0)})`);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(() => window.__flocon.state === 'paused');
  await page.getByRole('button', { name: 'Reprendre' }).click();
  await page.waitForFunction(() => window.__flocon.state === 'play');
  await page.context().close();
});

await check('a full night: landing, photo, stars, next night, album', async () => {
  const page = await newPage('?reset&autopilot&speed=8');
  await page.mouse.click(195, 600);
  await page.waitForFunction(() => window.__flocon.state === 'result', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  assert(await page.locator('.photo-wrap canvas').isVisible(), 'photo shown');
  assert((await page.locator('.star-line').count()) === 3, 'three objectives');
  const save = JSON.parse(await page.evaluate(() => localStorage.getItem('flocon.save.v1') || window.__flocon.store.flush() || localStorage.getItem('flocon.save.v1')));
  assert(save.levels['1-1'].done, 'level 1-1 saved as done');
  assert(save.album.length === 1, 'flake added to the album');
  await page.getByRole('button', { name: 'Nuit suivante' }).click();
  await page.waitForSelector('.sheet.in');
  assert(await page.getByText("L'air sec").first().isVisible(), 'intro of night 1-2');
  await page.getByRole('button', { name: 'Tomber' }).click();
  await page.waitForFunction(() => window.__flocon.state === 'play' && window.__flocon.levelId === '1-2');
  await page.evaluate(() => window.__flocon.quit());
  await page.evaluate(() => window.__flocon.goAlbum());
  await page.waitForSelector('.thumb canvas');
  await page.locator('.thumb').first().click();
  await page.waitForSelector('.sheet.in .photo-wrap');
  await page.context().close();
});

await check('menus, settings and language switch', async () => {
  const page = await newPage('?reset&debug&unlock=all');
  await page.evaluate(() => window.__flocon.goMenu());
  await page.waitForSelector('.menu-screen.in');
  assert((await page.locator('.menu-screen .cta').count()) === 1, 'continue button');
  assert((await page.locator('.menu-screen .tile').count()) === 3, 'three mode tiles');
  // Campaign complete: the main button opens the map of nights.
  await page.locator('.menu-screen .cta').click();
  await page.waitForSelector('.chapter');
  await page.waitForTimeout(500);
  assert((await page.locator('.screen.in .night').count()) === 30, '30 nights listed');
  await page.evaluate(() => window.__flocon.goSettings());
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.waitForSelector('text=Settings');
  await page.context().close();
});

await check('daily flake and blizzard modes start', async () => {
  const page = await newPage('?reset&debug&unlock=all');
  await page.evaluate(() => window.__flocon.startDaily());
  await page.waitForFunction(() => window.__flocon.state === 'play' && window.__flocon.mode === 'daily');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__flocon.startEndless());
  await page.waitForFunction(() => window.__flocon.state === 'play' && window.__flocon.mode === 'endless');
  await page.waitForTimeout(500);
  await page.context().close();
});

await check('synthesized audio: audible, no clipping, no invalid samples', async () => {
  const page = await newPage('?reset');
  const res = await page.evaluate(async () => {
    const { AudioEngine } = await import('./src/core/audio.js');
    const out = {};
    async function render(label, fn, seconds = 4) {
      const off = new OfflineAudioContext(2, 44100 * seconds, 44100);
      Object.defineProperty(off, 'state', { get: () => 'running' });
      const eng = new AudioEngine();
      eng.ctx = off;
      eng.build();
      clearInterval(eng.timer);
      fn(eng);
      const buf = await off.startRendering();
      let peak = 0;
      let bad = 0;
      for (let ch = 0; ch < 2; ch++) {
        for (const v of buf.getChannelData(ch)) {
          if (!Number.isFinite(v)) bad++;
          else peak = Math.max(peak, Math.abs(v));
        }
      }
      out[label] = { peak, bad };
    }
    await render('music', (e) => {
      e.playSong('peaks');
      e.nextBarTime = 0.05;
      e.schedule();
    });
    await render('sfx', (e) => {
      e.playSong('forest');
      for (const k of ['brume', 'sec', 'froid', 'givre', 'aurore', 'tourbillon']) e.mote(k, 120);
      e.hit('hail', true);
      e.land();
      e.newType();
      e.fail();
      e.shard(2, 5);
      e.merge();
    });
    return out;
  });
  for (const [k, v] of Object.entries(res)) {
    assert(v.bad === 0, `${k}: invalid samples`);
    assert(v.peak > 0.02, `${k}: silent (${v.peak})`);
    assert(v.peak < 0.98, `${k}: clipping (${v.peak})`);
  }
  await page.context().close();
});

await browser.close();
server.kill();
for (const [s, n] of results) console.log(`${s.padEnd(4)} ${n}`);
if (errors.length) console.log('\nBrowser errors:\n' + errors.join('\n'));
const failed = results.some(([s]) => s !== 'ok') || errors.length > 0;
console.log(failed ? '\nE2E: FAILED' : '\nE2E: all checks passed');
process.exit(failed ? 1 : 0);
