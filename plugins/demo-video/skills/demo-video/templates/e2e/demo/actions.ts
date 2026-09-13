import { Locator, Page } from '@playwright/test';

/**
 * Camera-friendly actions for demo takes.
 *
 * Motion is rendered IN the page at full frame rate (CSS transition for the
 * cursor, native smooth scrolling for the viewport) instead of being
 * synthesized from coarse input events, which stutters on video. The real
 * mouse is teleported invisibly after each animation so hover and click
 * behavior stays truthful to what the viewer sees.
 */

/** Glide the visual cursor to the center of `target`, then sync the real mouse to it. */
export async function glideTo(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('glideTo: target has no bounding box (not visible?)');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const duration = await page.evaluate(
    ([tx, ty]) => {
      const cur = document.getElementById('__demo-cursor');
      if (!cur || !(window as any).__demoCursorMove) {
        throw new Error('demo cursor overlay is not installed');
      }
      const rect = cur.getBoundingClientRect();
      const dist = Math.hypot(tx - rect.left, ty - rect.top);
      const ms = Math.min(1100, Math.max(350, dist * 1.1));
      (window as any).__demoCursorMove(tx, ty, ms);
      return ms;
    },
    [x, y]
  );
  await page.waitForTimeout(duration + 80);
  // Invisible sync so hover states and the click ripple match the visual.
  await page.mouse.move(x, y);
}

/** Glide to the element, pause a beat so the eye can settle, then click. */
export async function glideClick(page: Page, target: Locator): Promise<void> {
  await glideTo(page, target);
  await page.waitForTimeout(300);
  await target.click();
}

/**
 * Scroll the page by `deltaY` using the browser's native smooth scrolling
 * (rendered per-frame), waiting until the scroll position settles.
 */
export async function smoothScrollBy(
  page: Page,
  deltaY: number
): Promise<void> {
  await page.evaluate(
    (dy) => window.scrollBy({ top: dy, behavior: 'smooth' }),
    deltaY
  );
  // Wait until scrollY stops changing (two identical consecutive samples).
  await page.waitForFunction(
    () => {
      const w = window as any;
      const settled = w.__demoLastScrollY === window.scrollY;
      w.__demoLastScrollY = window.scrollY;
      return settled;
    },
    undefined,
    { polling: 120, timeout: 10_000 }
  );
}
