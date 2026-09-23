import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { DEMO_CONFIG } from '../../scripts/demo/config';
import { DemoDefinition, DemoTimings } from './define';
import { buildCursorOverlayJs } from './cursor';
import { login } from './login';

/**
 * Records a demo declared in e2e/demos/<slug>.demo.ts as ONE continuous
 * video, emitting per-take timestamps for the assembly pipeline
 * (scripts/demo/build.ts). Skipped unless DEMO=<slug> is set, so normal
 * e2e runs never record videos.
 *
 * Login happens OUTSIDE the recorded context (see ./login.ts, the
 * project-specific seam) so it never appears on video.
 */
const slug = process.env.DEMO;

test('record demo', async ({ browser }) => {
  test.skip(!slug, 'set DEMO=<slug> to record a demo');
  test.setTimeout(300_000);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const demo: DemoDefinition = require(`../demos/${slug}.demo.ts`).default;
  expect(demo.slug).toBe(slug);
  expect(demo.takes.length).toBeGreaterThan(0);

  const storageState = await login(browser);

  const outDir = path.join(process.cwd(), 'demo-output', slug!);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    storageState,
    baseURL: DEMO_CONFIG.baseURL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 720 } }
  });
  if (DEMO_CONFIG.features.cursorOverlay) {
    await context.addInitScript(
      buildCursorOverlayJs(DEMO_CONFIG.branding.accentColor)
    );
  }
  const page = await context.newPage();
  const t0 = Date.now();
  const sec = () => (Date.now() - t0) / 1000;

  const timings: DemoTimings = {
    slug: slug!,
    feature: demo.feature,
    takes: []
  };
  for (let i = 0; i < demo.takes.length; i++) {
    const take = demo.takes[i];
    const startSec = sec();
    await take.action(page);
    // Small settle so cuts never land mid-animation.
    await page.waitForTimeout(400);
    timings.takes.push({
      index: i,
      narration: take.narration,
      startSec,
      endSec: sec()
    });
  }

  const video = page.video();
  await context.close(); // flushes the video file
  if (!video) throw new Error('recording produced no video');
  const rawPath = await video.path();
  fs.copyFileSync(rawPath, path.join(outDir, 'raw.webm'));
  fs.writeFileSync(
    path.join(outDir, 'takes.json'),
    JSON.stringify(timings, null, 2)
  );
});
