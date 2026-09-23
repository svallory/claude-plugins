import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEMO_CONFIG } from './config';
import { OPENING_KICKER } from './narration';

/**
 * Render a slate to a 1280x720 PNG. Feature name is HTML-escaped.
 *
 * `kicker` is the small line above the feature name; it defaults to the brand
 * line, which is what an opening slate shows. Merged videos pass
 * INTERMEDIARY_KICKER for later features - see narration.ts.
 */
export async function renderTitleCard(
  feature: string,
  outPng: string,
  kicker: string = OPENING_KICKER
): Promise<void> {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const esc = escape(feature);
  const escKicker = escape(kicker);
  const accent = DEMO_CONFIG.branding.accentColor;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 1280px; height: 720px; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 18px; background: #1f2328; color: #fff;
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  /* No text-transform: it would flatten brand casing in the kicker. */
  .kicker { color: ${accent}; font-size: 26px; letter-spacing: .12em; }
  .feature { font-size: 54px; font-weight: 700; max-width: 1000px; text-align: center; }
  .rule { width: 120px; height: 4px; background: ${accent}; border-radius: 2px; }
</style></head><body>
  <div class="kicker">${escKicker}</div>
  <div class="rule"></div>
  <div class="feature">${esc}</div>
</body></html>`;
  const tmp = path.join(
    os.tmpdir(),
    `demo-title-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.html`
  );
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 }
    });
    await page.goto(`file://${tmp}`);
    await page.screenshot({ path: outPng });
  } finally {
    await browser.close();
    fs.unlinkSync(tmp);
  }
}
