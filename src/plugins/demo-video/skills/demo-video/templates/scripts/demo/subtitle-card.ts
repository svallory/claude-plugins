import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Render one subtitle cue to a full-frame 1280x720 transparent PNG, with a
 * dark pill near the bottom holding the (pre-wrapped) text. Composited onto
 * the video via ffmpeg's `overlay` filter - see the spec amendment on
 * finalizeArgs in ffmpeg.ts for why (the local ffmpeg build has no
 * `subtitles`/`drawtext` filter). Text is HTML-escaped; `\n` (from
 * wrapSubtitle) becomes a real line break.
 */
export async function renderSubtitleCard(
  text: string,
  outPng: string
): Promise<void> {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 1280px; height: 720px; background: transparent; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .pill {
    margin-bottom: 28px;
    max-width: 1000px;
    padding: 10px 22px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 22px;
    line-height: 1.35;
    text-align: center;
  }
</style></head><body>
  <div class="pill">${esc}</div>
</body></html>`;
  const tmp = path.join(
    os.tmpdir(),
    `demo-subtitle-${Date.now()}-${Math.random()
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
    await page.screenshot({ path: outPng, omitBackground: true });
  } finally {
    await browser.close();
    fs.unlinkSync(tmp);
  }
}
