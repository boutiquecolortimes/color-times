import { chromium } from 'playwright-core';
import fs from 'node:fs';
// Any Chromium/Chrome works: set CHROME_PATH, or it falls back to Playwright's bundled browser.
const exe = process.env.CHROME_PATH || undefined;
const screens = (process.argv[2] ?? 'dashboard').split(',');
const schemes = ['light', 'dark'];
const height = Number(process.argv[3] ?? 1500);
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
for (const screen of screens) for (const scheme of schemes) {
  const page = await browser.newPage({ viewport: { width: 390, height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:5173/?screen=${screen}&scheme=${scheme}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `shots/${screen}-${scheme}.png` });
  const boot = await page.$('#boot-error');
  console.log(screen, scheme, boot ? 'BOOT ERROR: ' + (await boot.innerText()).slice(0, 400) : 'ok', errors.slice(0, 4).map((e) => e.slice(0, 300)));
  await page.close();
}
await browser.close();
