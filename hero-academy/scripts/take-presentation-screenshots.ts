import { chromium, Page } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = resolve(process.cwd(), '../presentation-assets/screenshots');

// Test credentials — must exist via setup-test-data.mjs
const TEST_STUDENT_EMAIL = 'student@hero.academy';
const TEST_STUDENT_PASSWORD = 'Student123!';

const PARENT_EMAIL = 'parent@hero.academy';
const PARENT_PASSWORD = 'Parent123!';

interface Shot {
  slide: number;
  name: string;
  path: string;
  waitForSelector?: string;
}

const STUDENT_SHOTS: Shot[] = [
  { slide: 5,  name: 'hero-main',       path: '/hero',           waitForSelector: 'h1' },
  { slide: 8,  name: 'quests',          path: '/quests',         waitForSelector: 'h1' },
  { slide: 9,  name: 'hero-hp-detail',  path: '/hero',           waitForSelector: 'h1' },
  { slide: 10, name: 'artifacts',       path: '/artifacts',      waitForSelector: 'h1' },
  { slide: 12, name: 'shop',            path: '/shop',           waitForSelector: 'h1' },
  { slide: 13, name: 'leaderboard',     path: '/leaderboard',    waitForSelector: 'h1' },
  // Slide 14 boss screenshot taken manually — see Task 5.
  // Route is /boss/[id] (dynamic), and there is no /api/bosses/active
  // endpoint to look up the ID from. seed_boss.js doesn't hardcode an ID either.
];

const PARENT_SHOTS: Shot[] = [
  { slide: 15, name: 'parent-dashboard', path: '/parent', waitForSelector: 'h1' },
];

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/login`);
  // Login page labels are unlinked (no htmlFor); use CSS selectors instead.
  // Only one form on the page, so input[type=...] is unambiguous.
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for navigation away from /auth/login (networkidle is flaky here).
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 });
  // Bypass OnboardingGuard — it redirects to /onboarding until this key is set.
  await page.evaluate(() => {
    localStorage.setItem('hero-academy-onboarding', 'done');
  });
}

async function captureShot(page: Page, shot: Shot) {
  await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded' });

  if (page.url().includes('/auth/login')) {
    throw new Error(`Redirected to login while capturing ${shot.path} — session invalid`);
  }

  if (shot.waitForSelector) {
    await page.waitForSelector(shot.waitForSelector, { timeout: 10_000 });
  }
  await page.waitForTimeout(1000); // Let animations settle
  const file = `${OUT_DIR}/slide-${shot.slide}-${shot.name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✅ slide ${shot.slide}: ${shot.name} → ${file}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();

  // Student context — isolated from parent session
  const studentCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const studentPage = await studentCtx.newPage();
  console.log('📸 Student screenshots...');
  await login(studentPage, TEST_STUDENT_EMAIL, TEST_STUDENT_PASSWORD);
  for (const shot of STUDENT_SHOTS) {
    await captureShot(studentPage, shot);
  }
  await studentCtx.close();

  // Parent context — fresh context so /auth/login doesn't redirect an
  // already-authenticated student session.
  const parentCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const parentPage = await parentCtx.newPage();
  console.log('\n📸 Parent screenshots...');
  await login(parentPage, PARENT_EMAIL, PARENT_PASSWORD);
  for (const shot of PARENT_SHOTS) {
    await captureShot(parentPage, shot);
  }
  await parentCtx.close();

  await browser.close();
  console.log('\n✨ Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
