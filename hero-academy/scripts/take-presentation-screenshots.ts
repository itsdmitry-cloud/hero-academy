import { chromium, Page } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = resolve(process.cwd(), '../presentation-assets/screenshots');

// Test student credentials — must exist via setup-test-data.mjs
const TEST_STUDENT_EMAIL = 'student1@test.local';
const TEST_STUDENT_PASSWORD = 'test12345';

interface Shot {
  slide: number;
  name: string;
  path: string;
  waitForSelector?: string;
}

const STUDENT_SHOTS: Shot[] = [
  { slide: 5,  name: 'hero-main',       path: '/hero',           waitForSelector: 'text=/HP/i' },
  { slide: 8,  name: 'quests',          path: '/quests',         waitForSelector: 'text=/квест/i' },
  { slide: 9,  name: 'hero-hp-detail',  path: '/hero',           waitForSelector: 'text=/HP/i' },
  { slide: 10, name: 'artifacts',       path: '/artifacts',      waitForSelector: 'text=/артефакт/i' },
  { slide: 12, name: 'shop',            path: '/shop',           waitForSelector: 'text=/магазин/i' },
  { slide: 13, name: 'leaderboard',     path: '/leaderboard',    waitForSelector: 'text=/лидер|топ/i' },
  { slide: 14, name: 'boss-active',     path: '/boss',           waitForSelector: 'text=/босс|hp/i' },
];

const PARENT_EMAIL = 'parent1@test.local';
const PARENT_PASSWORD = 'test12345';

const PARENT_SHOTS: Shot[] = [
  { slide: 15, name: 'parent-dashboard', path: '/parent', waitForSelector: 'text=/оценк|прогресс/i' },
];

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.getByLabel(/email|почта/i).fill(email);
  await page.getByLabel(/пароль|password/i).fill(password);
  await page.getByRole('button', { name: /войти|login/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
}

async function captureShot(page: Page, shot: Shot) {
  await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded' });
  if (shot.waitForSelector) {
    try {
      await page.waitForSelector(shot.waitForSelector, { timeout: 10_000 });
    } catch {
      console.warn(`  ⚠️  Selector "${shot.waitForSelector}" not found on ${shot.path} — capturing anyway`);
    }
  }
  await page.waitForTimeout(1000); // Let animations settle
  const file = `${OUT_DIR}/slide-${shot.slide}-${shot.name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✅ slide ${shot.slide}: ${shot.name} → ${file}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('📸 Student screenshots...');
  await login(page, TEST_STUDENT_EMAIL, TEST_STUDENT_PASSWORD);
  for (const shot of STUDENT_SHOTS) {
    await captureShot(page, shot);
  }

  console.log('\n📸 Parent screenshots...');
  await login(page, PARENT_EMAIL, PARENT_PASSWORD);
  for (const shot of PARENT_SHOTS) {
    await captureShot(page, shot);
  }

  await browser.close();
  console.log('\n✨ Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
