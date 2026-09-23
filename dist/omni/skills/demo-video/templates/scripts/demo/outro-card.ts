import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEMO_CONFIG } from './config';

/**
 * Render the outro slate, 1280x720 on black: either the configured SVG logo
 * (branding.outroLogoSvg, repo-relative; fills forced white via CSS so the
 * source asset stays untouched) or the configured text
 * (branding.outroText). Throws if the outro feature is on but neither is set.
 */
export async function renderOutroCard(outPng: string): Promise<void> {
  const { outroLogoSvg, outroText } = DEMO_CONFIG.branding;
  let center: string;
  if (outroLogoSvg) {
    center = fs.readFileSync(outroLogoSvg, 'utf8');
  } else if (outroText) {
    const esc = outroText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    center = `<div class="text">${esc}</div>`;
  } else {
    throw new Error(
      'features.outro is on but branding.outroLogoSvg and branding.outroText are both null (.claude/demo-video-skill.config.json)'
    );
  }
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 1280px; height: 720px; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #000; color: #fff;
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  svg { width: 640px; height: auto; }
  svg path { fill: #ffffff !important; }
  .text { font-size: 48px; font-weight: 700; letter-spacing: .04em; }
</style></head><body>
  ${center}
</body></html>`;
  const tmp = path.join(os.tmpdir(), `demo-outro-${Date.now()}.html`);
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
