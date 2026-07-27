import { createRequire } from 'node:module';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/resumeloomr-promo-tools/node_modules/playwright-core');

const root = path.dirname(new URL(import.meta.url).pathname);
const framesDir = path.join(root, 'frames');
const fps = Number(process.env.PROMO_FPS || 30);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
});
const page = await context.newPage();

await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
await page.evaluate(() => Promise.all(Array.from(document.images).map((image) => image.decode())));

const duration = await page.evaluate(() => window.PROMO_DURATION);
const frameCount = Math.ceil(duration * fps);
const pad = String(frameCount).length;

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / fps;
  await page.evaluate((nextTime) => window.renderFrame(nextTime), time);
  await page.screenshot({
    path: path.join(framesDir, `${String(frame).padStart(pad, '0')}.jpg`),
    type: 'jpeg',
    quality: 94,
    animations: 'disabled',
  });

  if (frame % (fps * 5) === 0) {
    process.stdout.write(`Rendered ${frame}/${frameCount}\n`);
  }
}

await context.close();
await browser.close();
process.stdout.write(`Rendered ${frameCount} frames at ${fps} fps to ${framesDir}\n`);
