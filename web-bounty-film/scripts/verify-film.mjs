import { chromium } from '/usr/local/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleMsgs = [];
page.on('console', (m) => { if (/motion player|error|warning/i.test(m.text())) consoleMsgs.push(m.text()); });
page.on('pageerror', (e) => consoleMsgs.push('PAGEERROR: ' + e.message));

await page.goto('https://rork-bounty-urban-scavenger-hunt.rork.app', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Play, let it run into scene 2 (~7s), screenshot
await page.getByRole('button', { name: /play/i }).first().click();
await page.waitForTimeout(7000);
await page.screenshot({ path: '.rork/web-verification/film-scene2.png' });

// Into scene 4 pool (~16s)
await page.waitForTimeout(7000);
await page.screenshot({ path: '.rork/web-verification/film-scene4.png' });

// Scene 5 connect (~21s)
await page.waitForTimeout(5000);
await page.screenshot({ path: '.rork/web-verification/film-scene5.png' });

// Seek to the end via keyboard: End key -> last frame = end card
await page.getByRole('button', { name: /play|replay|pause/i }).first().click(); // focus player
await page.keyboard.press('End');
await page.waitForTimeout(1500);
await page.screenshot({ path: '.rork/web-verification/film-end.png' });

// Seek back: Left arrow = 5s back, twice -> ~21s connect again
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(800);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(800);
await page.screenshot({ path: '.rork/web-verification/film-seekback.png' });

console.log('CONSOLE MESSAGES:', JSON.stringify(consoleMsgs, null, 2));
await browser.close();
