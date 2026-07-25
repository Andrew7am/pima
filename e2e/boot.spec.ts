import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// Network failures are expected here: CI builds against a dummy Supabase URL,
// so data calls legitimately fail. What must NEVER happen is an uncaught
// JavaScript exception — that is the class of bug (module init / TDZ) that took
// the site down, and it is what these tests actually guard.
function collectFatals(page: Page) {
  const fatals: string[] = [];

  page.on('pageerror', (err) => {
    fatals.push(`pageerror: ${err.message}`);
  });

  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Ignore the noise a fake backend produces.
    if (/Failed to load resource|net::ERR_|ERR_NAME_NOT_RESOLVED|fetch|NetworkError|supabase/i.test(text)) return;
    fatals.push(`console: ${text}`);
  });

  return fatals;
}

test.describe('production bundle boots', () => {
  test('mounts React without an uncaught exception', async ({ page }) => {
    const fatals = collectFatals(page);

    await page.goto('/', { waitUntil: 'load' });

    // The shell must hand over to React — an empty #root is the exact symptom
    // of the chunk-initialisation outage (page loads, nothing ever renders).
    await expect
      .poll(async () => page.locator('#root > *').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    expect(fatals, `Fatal errors during boot:\n${fatals.join('\n')}`).toEqual([]);
  });

  // Regression guard for the specific failure mode: splitting vendor chunks in
  // vite.config.ts created a cycle whose symptom was a TDZ ReferenceError.
  test('no module-initialisation (TDZ) error in any chunk', async ({ page }) => {
    const initErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (/before initialization|is not defined|Cannot access/i.test(err.message)) {
        initErrors.push(err.message);
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' }).catch(() => page.goto('/'));
    expect(initErrors, `Chunk init errors:\n${initErrors.join('\n')}`).toEqual([]);
  });

  test('renders the Arabic app shell and its title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/بيما/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  // A logged-out visitor must reach the browsing experience, not a dead end —
  // this is the top of the entire acquisition funnel.
  test('a guest lands on a usable screen', async ({ page }) => {
    const fatals = collectFatals(page);
    await page.goto('/');

    await expect
      .poll(async () => page.locator('#root > *').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // Either the explore shell or the auth entry point — both are valid guest
    // landings depending on stored session, and neither may crash.
    await expect(page.locator('body')).toContainText(/بيما|تسجيل الدخول|استكشاف/);
    expect(fatals).toEqual([]);
  });
});

test.describe('static content pages', () => {
  // /dalil/ is plain static HTML that must stay crawlable for SEO/AdSense —
  // a broken build here silently de-indexes the content strategy.
  test('the guide index is served', async ({ page }) => {
    const res = await page.goto('/dalil/index.html');
    expect(res?.status()).toBe(200);
    await expect(page.locator('body')).toContainText(/دليل|مؤتمر|خلوة/);
  });
});
