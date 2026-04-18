/**
 * capture-screenshots.ts
 *
 * Captures up-to-date screenshots of every major page in the VibeHired UI
 * and writes them to the `demo/` directory at the project root.
 *
 * Usage (run from `server/` directory):
 *   npm run capture-screenshots -- --user admin@example.com --pass yourpassword
 *
 * Or via environment variables:
 *   SCREENSHOT_USER=admin@example.com SCREENSHOT_PASS=yourpassword npm run capture-screenshots
 *
 * Prerequisites:
 * - The frontend dev server must be running at http://localhost:5173
 * - The backend dev server must be running at http://localhost:5001
 * - A valid user account must exist in the database
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Configuration ────────────────────────────────────────────────────────────

const FRONTEND_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:5173';
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };
const DEMO_DIR = path.resolve(__dirname, '../../demo');
const SCREENSHOT_TIMEOUT = 30_000; // ms to wait for navigation / selectors

// Resolve credentials from CLI args or environment variables
function resolveCredentials(): { email: string; password: string } {
  const args = process.argv.slice(2);
  let email = process.env.SCREENSHOT_USER ?? '';
  let password = process.env.SCREENSHOT_PASS ?? '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user' && args[i + 1]) email = args[++i];
    if (args[i] === '--pass' && args[i + 1]) password = args[++i];
  }

  if (!email || !password) {
    console.error(
      '\n❌  Credentials required.\n' +
        '    Pass via CLI:  --user <email> --pass <password>\n' +
        '    Or via env:    SCREENSHOT_USER / SCREENSHOT_PASS\n'
    );
    process.exit(1);
  }

  return { email, password };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForPageReady(page: Page): Promise<void> {
  // Wait for network idle (no more than 2 pending requests for 500 ms)
  await page.waitForNetworkIdle({ idleTime: 500, timeout: SCREENSHOT_TIMEOUT }).catch(() => {});
  // Small buffer for animations / skeleton loaders to resolve
  await new Promise(r => setTimeout(r, 600));
}

async function capture(page: Page, filename: string): Promise<void> {
  const filePath = path.join(DEMO_DIR, filename);
  await waitForPageReady(page);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  ✔  ${filename}`);
}

async function navigate(page: Page, urlPath: string): Promise<void> {
  await page.goto(`${FRONTEND_URL}${urlPath}`, {
    waitUntil: 'networkidle2',
    timeout: SCREENSHOT_TIMEOUT,
  });
  await new Promise(r => setTimeout(r, 400));
}

async function clickSelector(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 5_000 }).catch(() => {});
  await page.click(selector).catch(() => {});
  await new Promise(r => setTimeout(r, 400));
}

// ── Login flow ────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string): Promise<void> {
  console.log('\n  Logging in …');
  await navigate(page, '/login');

  // Fill email
  const emailInput = await page
    .waitForSelector('input[type="email"], input[name="email"]', { timeout: SCREENSHOT_TIMEOUT })
    .catch(() => null);
  if (!emailInput) throw new Error('Could not find email input on /login');
  await emailInput.type(email, { delay: 30 });

  // Fill password
  const passInput = await page
    .waitForSelector('input[type="password"], input[name="password"]', { timeout: 5_000 })
    .catch(() => null);
  if (!passInput) throw new Error('Could not find password input on /login');
  await passInput.type(password, { delay: 30 });

  // Submit
  await page.keyboard.press('Enter');

  // Wait until we land on /dashboard (or any non-login page)
  await page
    .waitForFunction(
      () => !window.location.pathname.startsWith('/login'),
      { timeout: SCREENSHOT_TIMEOUT }
    )
    .catch(() => {
      throw new Error('Login failed — still on /login after form submit');
    });

  console.log('  ✔  Signed in');
}

// ── Fetch a valid job ID ───────────────────────────────────────────────────────

async function fetchFirstJobId(page: Page): Promise<string | null> {
  try {
    const result = await page.evaluate(async () => {
      const token = Object.entries(localStorage).find(([k]) =>
        k.toLowerCase().includes('token')
      )?.[1];
      if (!token) return null;
      const res = await fetch('/api/job-applications?limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const jobs = data.jobs ?? data.data ?? data;
      return Array.isArray(jobs) && jobs.length > 0 ? (jobs[0]._id ?? jobs[0].id) : null;
    });
    return result ?? null;
  } catch {
    return null;
  }
}

// ── Fetch portfolio username ───────────────────────────────────────────────────

async function fetchPortfolioUsername(page: Page): Promise<string | null> {
  try {
    const result = await page.evaluate(async () => {
      const token = Object.entries(localStorage).find(([k]) =>
        k.toLowerCase().includes('token')
      )?.[1];
      if (!token) return null;
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.username as string) ?? null;
    });
    return result ?? null;
  } catch {
    return null;
  }
}

// ── Main capture sequence ─────────────────────────────────────────────────────

async function run(): Promise<void> {
  const { email, password } = resolveCredentials();

  if (!fs.existsSync(DEMO_DIR)) {
    fs.mkdirSync(DEMO_DIR, { recursive: true });
  }

  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page: Page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // ── Auth pages (no login required) ────────────────────────────────────────
    console.log('\n📸  Auth pages');

    await navigate(page, '/login');
    await capture(page, 'login.png');

    await navigate(page, '/register');
    await capture(page, 'register.png');

    await navigate(page, '/forgot-password');
    await capture(page, 'forgot-password.png');

    // ── Log in ─────────────────────────────────────────────────────────────────
    await login(page, email, password);

    // Fetch job ID and username while on an authenticated page
    const jobId = await fetchFirstJobId(page);
    const portfolioUsername = await fetchPortfolioUsername(page);

    if (!jobId) {
      console.warn(
        '\n  ⚠  No job applications found — review/job-specific screenshots will be skipped.\n' +
          '     Add at least one job application and re-run.'
      );
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────
    console.log('\n📸  Dashboard');
    await navigate(page, '/dashboard');
    await capture(page, 'main-dashboard.png');

    // Try to switch to kanban view
    const kanbanBtn = await page
      .$('button[aria-label*="anban"], button[title*="anban"], [data-view="kanban"]')
      .catch(() => null);
    if (kanbanBtn) {
      await kanbanBtn.click();
      await new Promise(r => setTimeout(r, 600));
    } else {
      // Fallback: look for a toggle/grid icon button after the table is visible
      await clickSelector(page, '[data-testid="kanban-toggle"], .kanban-toggle');
    }
    await capture(page, 'dashboard-kanban.png');

    // ── Other main pages ───────────────────────────────────────────────────────
    console.log('\n📸  Main pages');

    await navigate(page, '/auto-jobs');
    await capture(page, 'auto-jobs.png');

    await navigate(page, '/manage-cv');
    await capture(page, 'cv-management.png');

    await navigate(page, '/analytics');
    await capture(page, 'analytics-dashboard.png');

    await navigate(page, '/settings');
    await capture(page, 'settings.png');

    // ── Portfolio setup ────────────────────────────────────────────────────────
    console.log('\n📸  Portfolio setup');

    await navigate(page, '/portfolio-setup?tab=0');
    await capture(page, 'portfolio-setup.png');

    await navigate(page, '/portfolio-setup?tab=1');
    await capture(page, 'portfolio-setup-github.png');

    await navigate(page, '/portfolio-setup?tab=2');
    await capture(page, 'portfolio-setup-linkedin.png');

    await navigate(page, '/portfolio-setup?tab=3');
    await capture(page, 'portfolio-setup-publish.png');

    await navigate(page, '/portfolio-setup?tab=4');
    await capture(page, 'portfolio-setup-community.png');

    // ── Public portfolio ───────────────────────────────────────────────────────
    if (portfolioUsername) {
      console.log('\n📸  Public portfolio');
      await navigate(page, `/portfolio/${portfolioUsername}`);
      await capture(page, 'custom-portfolio.png');
    } else {
      console.warn('\n  ⚠  No portfolio username set — custom-portfolio.png skipped.');
    }

    // ── Review / job-specific pages ────────────────────────────────────────────
    if (jobId) {
      console.log('\n📸  Review pages');

      await navigate(page, `/jobs/${jobId}/review/cv`);
      await capture(page, 'custom-job-cv.png');

      await navigate(page, `/jobs/${jobId}/review/cover-letter`);
      await capture(page, 'custom-job-coverletter.png');

      // Job details — navigate to dashboard and expand a row
      await navigate(page, '/dashboard');
      const jobRow = await page.$('tr[data-job-id], .job-row, tbody tr:first-child').catch(() => null);
      if (jobRow) {
        await jobRow.click();
        await new Promise(r => setTimeout(r, 700));
        await capture(page, 'job-details.png');
      } else {
        console.warn('\n  ⚠  Could not find clickable job row — job-details.png skipped.');
      }
    }

    console.log(`\n✅  Done! Screenshots saved to ${DEMO_DIR}\n`);
  } catch (err) {
    console.error('\n❌  Screenshot capture failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
