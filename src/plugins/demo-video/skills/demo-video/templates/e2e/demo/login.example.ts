import { Browser } from '@playwright/test';
import { DEMO_CONFIG } from '../../scripts/demo/config';

/**
 * PROJECT-SPECIFIC SEAM - copy to e2e/demo/login.ts and adapt.
 *
 * Log in OUTSIDE the recorded context and return the storage state the
 * recording context should start with, so login footage never appears on
 * video. If the app has no auth, return undefined.
 */
export async function login(
  browser: Browser
): Promise<
  | Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>
  | undefined
> {
  const context = await browser.newContext({ baseURL: DEMO_CONFIG.baseURL });
  const page = await context.newPage();
  await page.goto('/login');
  // ADAPT: fill your app's real login form with test credentials.
  await page.locator('input[name="username"]').fill('demo@example.com');
  await page.locator('input[name="password"]').fill('demo-password');
  await page.getByRole('button', { name: /log ?in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'));
  const storageState = await context.storageState();
  await context.close();
  return storageState;
}
