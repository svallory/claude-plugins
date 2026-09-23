import * as fs from 'fs';
import * as path from 'path';

/**
 * Builds the script injected into every demo page. Playwright videos do not
 * include the OS cursor, so this draws one (e2e/demo/pointer.png, embedded
 * as a data URI so the page needs no extra request), plus a ripple on real
 * mousedown events.
 *
 * Motion design: the visual cursor is NOT driven by real mousemove events -
 * Playwright dispatches those in coarse steps that stutter on video. Instead
 * the kit (actions.ts) calls `window.__demoCursorMove(x, y, durationMs)` and
 * the browser animates the element with a CSS transition at full frame rate.
 * The real mouse teleports to the same point afterwards, invisibly, so
 * hover/click behavior stays truthful.
 *
 * The cursor starts near the center of the viewport with a little random
 * jitter, like a hand resting mid-screen.
 *
 * The pointer art's tip is at its top-left corner, so the image's top-left
 * is pinned to the cursor position - same hotspot as a native cursor.
 */
export function buildCursorOverlayJs(rippleColor = '#f36f21'): string {
  const pointerB64 = fs
    .readFileSync(path.join(__dirname, 'pointer.png'))
    .toString('base64');

  return `
(() => {
  if (window.__demoCursorInstalled) return;
  window.__demoCursorInstalled = true;
  const style = document.createElement('style');
  style.textContent = \`
    #__demo-cursor {
      position: fixed; z-index: 2147483647; pointer-events: none;
      width: 28px; height: 28px;
      background: url('data:image/png;base64,${pointerB64}') no-repeat;
      background-size: contain;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,.4));
      will-change: left, top;
    }
    .__demo-ripple {
      position: fixed; z-index: 2147483646; pointer-events: none;
      width: 12px; height: 12px; border-radius: 50%;
      border: 3px solid ${rippleColor}; transform: translate(-50%, -50%) scale(1);
      opacity: .9; animation: __demo-ripple .45s ease-out forwards;
    }
    @keyframes __demo-ripple {
      to { transform: translate(-50%, -50%) scale(4); opacity: 0; }
    }
  \`;
  const install = () => {
    document.head.appendChild(style);
    const cur = document.createElement('div');
    cur.id = '__demo-cursor';
    // Start near the center of the viewport with a bit of jitter.
    const jitter = (range) => (Math.random() - 0.5) * 2 * range;
    cur.style.left = (window.innerWidth / 2 + jitter(120)) + 'px';
    cur.style.top = (window.innerHeight / 2 + jitter(80)) + 'px';
    document.body.appendChild(cur);

    // Called by the demo kit; animates at full frame rate via CSS.
    window.__demoCursorMove = (x, y, durationMs) => {
      cur.style.transition =
        'left ' + durationMs + 'ms cubic-bezier(.25,.1,.25,1), ' +
        'top ' + durationMs + 'ms cubic-bezier(.25,.1,.25,1)';
      // Force a style flush so the transition applies even right after install.
      void cur.offsetLeft;
      cur.style.left = x + 'px';
      cur.style.top = y + 'px';
    };

    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.className = '__demo-ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
`;
}
