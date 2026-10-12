import { webkit, devices } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.RNA_EXPLORER_URL || 'http://127.0.0.1:4173';
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

async function openAndCheck(url, label) {
  const started = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.topbar', { state: 'visible', timeout: 10000 });
  const state = await page.evaluate(() => ({
    title: document.title,
    bodyText: document.body?.innerText?.slice(0, 1200) || '',
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    readyState: document.readyState,
    brand: document.querySelector('.brand')?.textContent?.replace(/\s+/g, ' ').trim() || ''
  }));
  assert.match(state.brand, /RNA Structure Explorer/i, `${label}: brand did not render`);
  assert(state.bodyText.length > 100, `${label}: page body is essentially empty`);
  assert(state.scrollWidth <= state.width + 60, `${label}: extreme horizontal overflow (${state.scrollWidth} vs ${state.width})`);
  console.log(`${label}: ${Date.now() - started} ms`, state);
}

try {
  await openAndCheck(`${BASE}/`, 'home');
  await openAndCheck(`${BASE}/?page=drawing`, 'drawing launcher');
  await page.waitForSelector('#workspaceLauncher', { state: 'visible', timeout: 10000 });
  const launcherText = await page.locator('#workspaceLauncher').innerText();
  assert.match(launcherText, /Choose how to begin/i, 'drawing launcher did not render');

  const serious = errors.filter(x => !/favicon|ResizeObserver loop/i.test(x));
  assert.equal(serious.length, 0, `Mobile Safari browser errors:\n${serious.join('\n')}`);
  console.log('Mobile Safari load regression: PASS');
} finally {
  await page.screenshot({ path: '/tmp/mobile-safari-load.png', fullPage: true }).catch(() => {});
  await browser.close();
}
