# Presentation for Parents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 22-slide Google Slides presentation for the parents of 6th grade school "Циркуль" — with real in-game screenshots, a Google Form consent form, and a QR code — following the spec at `docs/superpowers/specs/2026-04-23-parent-presentation-design.md`.

**Architecture:** Screenshots are captured via a Playwright script from the running local Next.js dev server (hero-academy) against a seeded test student account. Presentation is assembled via the `mcp__google-workspace__*` toolchain under the `personal` account. Consent form is a Google Form with a 3-field structure; its short link is QR-encoded and embedded on slides 20 and 22. Placeholders for personal photos (Slide 2, 19, 22) are filled in at the end when the user supplies them.

**Tech Stack:**
- Next.js 16 dev server (`hero-academy/`), Supabase backend, seed scripts
- Playwright (to be installed) — browser screenshots at 1920×1080
- `qrcode` npm package — to generate QR PNG from short URL
- Google Workspace MCP (`createPresentation`, `addSlide`, `addTextToSlide`, `insertLocalImage`, `createForm`, `addFormQuestion`, `getShareableLink`, etc.)
- Spec source: `docs/superpowers/specs/2026-04-23-parent-presentation-design.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `hero-academy/scripts/take-presentation-screenshots.ts` | Playwright automation: login as test student, visit each required page, capture PNG |
| `hero-academy/package.json` | Add `playwright`, `qrcode` devDependencies |
| `hero-academy/.playwright/` (generated) | Playwright browser binaries cache |
| `presentation-assets/screenshots/` | Captured in-game PNG files (~10 images) |
| `presentation-assets/qr-consent.png` | QR code for consent form |
| `presentation-assets/README.md` | Log of filenames + descriptions + retake status |
| `docs/superpowers/plans/2026-04-23-parent-presentation-implementation.md` | This plan |

**Artifacts tracked outside the repo:**
- Google Slides presentation → URL stored at end of plan
- Google Form consent → URL + form ID stored at end of plan

---

## Task 1: Install dependencies and verify dev environment

**Files:**
- Modify: `hero-academy/package.json`
- Create (via install): `hero-academy/node_modules/playwright/`, `hero-academy/node_modules/qrcode/`

- [ ] **Step 1: Install Playwright and qrcode**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npm install --save-dev playwright qrcode @types/qrcode
```

Expected: both packages land in `devDependencies` of package.json.

- [ ] **Step 2: Install Playwright Chromium browser**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx playwright install chromium
```

Expected: Chromium downloaded into Playwright's browser cache.

- [ ] **Step 3: Start the dev server in background**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npm run dev
```

Run via `run_in_background: true`. Confirm server listens on `http://localhost:3000` (poll with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/auth/login` — expect `200`).

- [ ] **Step 4: Verify test student exists in DB (run seed if needed)**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
node scripts/setup-test-data.mjs
```

Expected output: "✅" lines for school, class, teacher, parent, students. If it says "ℹ️ exists" lines — already set up, skip.

- [ ] **Step 5: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/package.json hero-academy/package-lock.json
git commit -m "chore(presentation): add playwright + qrcode for screenshot automation"
```

---

## Task 2: Create Google Form for consent

**Files:** No local files. Artifact is remote Google Form.

- [ ] **Step 1: Create the form via MCP**

Call `mcp__google-workspace__createForm` with:

```json
{
  "account": "personal",
  "title": "Согласие на участие в пилоте Академии Героев × Циркуль (6 класс, май 2026)",
  "description": "2 минуты. Если согласны — подпишите до 1 мая. Можно отозвать согласие в любой момент."
}
```

Expected: returned form ID and edit URL. Save both; they are referenced in Task 3 and Task 12.

- [ ] **Step 2: Add question 1 — согласие/несогласие (radio)**

Call `mcp__google-workspace__addFormQuestion` with:

```json
{
  "account": "personal",
  "formId": "<form-id-from-step-1>",
  "title": "Даёте ли вы согласие на участие вашего ребёнка в пилоте Академии Героев 4-25 мая 2026?",
  "type": "RADIO",
  "required": true,
  "options": ["Да, согласен(на)", "Нет", "Хочу обсудить лично перед ответом"]
}
```

Expected: question added, HTTP 200.

- [ ] **Step 3: Add question 2 — ФИО родителя и ребёнка (short text)**

Call `mcp__google-workspace__addFormQuestion` with:

```json
{
  "account": "personal",
  "formId": "<form-id>",
  "title": "ФИО родителя + ФИО ребёнка (одним полем)",
  "type": "SHORT_ANSWER",
  "required": true
}
```

- [ ] **Step 4: Add question 3 — свободные вопросы/тревоги (long text)**

Call `mcp__google-workspace__addFormQuestion` with:

```json
{
  "account": "personal",
  "formId": "<form-id>",
  "title": "Есть ли у вас вопросы или тревоги, которые я должен развеять лично?",
  "type": "PARAGRAPH",
  "required": false
}
```

- [ ] **Step 5: Get the shareable link**

Call `mcp__google-workspace__getShareableLink` with the form ID. Record the full URL (typically `https://docs.google.com/forms/d/e/<id>/viewform`).

- [ ] **Step 6: Open the form in a browser and submit a test response**

Run:
```bash
open "<form-url>"
```

Manually submit one test response to confirm the form works end-to-end. Then delete the test response (via `readForm` → note response ID — or leave, small noise).

- [ ] **Step 7: Store URL in plan file**

Edit this plan file (`docs/superpowers/plans/2026-04-23-parent-presentation-implementation.md`) at the bottom under "Deliverables" section — append:

```
Consent form: <form-url>
Consent form ID: <form-id>
```

- [ ] **Step 8: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add docs/superpowers/plans/2026-04-23-parent-presentation-implementation.md
git commit -m "feat(presentation): create consent Google Form + record URL"
```

---

## Task 3: Generate QR code from consent form URL

**Files:**
- Create: `presentation-assets/qr-consent.png`
- Create: `hero-academy/scripts/generate-qr.ts`

- [ ] **Step 1: Create the QR generator script**

Create file `hero-academy/scripts/generate-qr.ts` with exact content:

```typescript
import QRCode from 'qrcode';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const url = process.argv[2];
const outPath = process.argv[3] ?? '../presentation-assets/qr-consent.png';

if (!url) {
  console.error('Usage: tsx scripts/generate-qr.ts <url> [out-path]');
  process.exit(1);
}

const absOut = resolve(process.cwd(), outPath);
mkdirSync(dirname(absOut), { recursive: true });

await QRCode.toFile(absOut, url, {
  width: 800,
  margin: 2,
  color: { dark: '#1a1a2e', light: '#ffffff' },
});

console.log(`QR code written to: ${absOut}`);
```

- [ ] **Step 2: Run the script with the consent form URL**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsx scripts/generate-qr.ts "<consent-form-url-from-task-2>" "../presentation-assets/qr-consent.png"
```

Expected output: `QR code written to: /Users/macbookm/Hero academy/presentation-assets/qr-consent.png`

- [ ] **Step 3: Verify PNG file exists**

```bash
ls -la "/Users/macbookm/Hero academy/presentation-assets/qr-consent.png"
```

Expected: file exists, ~10-30 KB.

- [ ] **Step 4: Test the QR by decoding it**

Open the PNG in Preview.app and scan with phone camera to confirm it decodes to the correct consent form URL.

```bash
open "/Users/macbookm/Hero academy/presentation-assets/qr-consent.png"
```

User confirms: scanned, URL matches. If it doesn't — rerun Step 2 with correct URL.

- [ ] **Step 5: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/scripts/generate-qr.ts presentation-assets/qr-consent.png
git commit -m "feat(presentation): generate QR code for consent form"
```

---

## Task 4: Write Playwright screenshot script

**Files:**
- Create: `hero-academy/scripts/take-presentation-screenshots.ts`

Script structure (complete, not placeholder):

- [ ] **Step 1: Create the screenshot script**

Create file `hero-academy/scripts/take-presentation-screenshots.ts` with exact content:

```typescript
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
```

- [ ] **Step 2: Commit the script (before running)**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/scripts/take-presentation-screenshots.ts
git commit -m "feat(presentation): add Playwright screenshot script"
```

---

## Task 5: Execute the screenshot session

**Files:**
- Create: `presentation-assets/screenshots/slide-*.png` (8 files)
- Create: `presentation-assets/README.md`

- [ ] **Step 1: Confirm dev server is still running**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/auth/login
```

Expected: `200`. If not, restart per Task 1 Step 3.

- [ ] **Step 2: Verify test credentials work manually**

Open `http://localhost:3000/auth/login` in a browser, log in as `student1@test.local / test12345`. Confirm redirect to `/hero` and that the page shows a populated hero (non-zero HP, XP, at least some artifacts).

**If hero looks empty/broken:** pause and fix test data before continuing. Options:
- Check seed scripts in `hero-academy/scripts/`
- Manually play a few quest grades as the test teacher account to populate data
- Adjust `STUDENT_SHOTS` waitForSelectors if pages have changed

- [ ] **Step 3: Run the screenshot script**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsx scripts/take-presentation-screenshots.ts
```

Expected: 8 "✅ slide N" lines, then "✨ Done."

- [ ] **Step 4: Verify all 8 PNGs exist**

```bash
ls -la "/Users/macbookm/Hero academy/presentation-assets/screenshots/"
```

Expected: 8 files, each slide-N-NAME.png, typically 100-500 KB each.

- [ ] **Step 5: Visually review each screenshot**

```bash
open "/Users/macbookm/Hero academy/presentation-assets/screenshots/"
```

User walks through each PNG and marks acceptable vs needs-retake. For any slide marked **needs-retake**, user either:
- Retakes manually (Cmd+Shift+4 on the live page) and replaces the file
- OR, if the problem is data (empty state), adjusts seed, re-runs Step 3

- [ ] **Step 6: Create README catalog**

Create `presentation-assets/README.md` with:

```markdown
# Presentation Assets

Generated: 2026-04-23

## Screenshots

| Slide | File | Source page | Status |
|---|---|---|---|
| 5 | slide-5-hero-main.png | /hero (student) | ✅ |
| 8 | slide-8-quests.png | /quests (student) | ✅ |
| 9 | slide-9-hero-hp-detail.png | /hero (student) | ✅ |
| 10 | slide-10-artifacts.png | /artifacts (student) | ✅ |
| 12 | slide-12-shop.png | /shop (student) | ✅ |
| 13 | slide-13-leaderboard.png | /leaderboard (student) | ✅ |
| 14 | slide-14-boss-active.png | /boss (student) | ✅ |
| 15 | slide-15-parent-dashboard.png | /parent | ✅ |

## Other assets

- `qr-consent.png` — QR code linking to Google Form (Task 3)
```

- [ ] **Step 7: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add presentation-assets/
git commit -m "feat(presentation): capture in-game screenshots for slides"
```

---

## Task 6: Create empty Google Slides presentation

**Files:** No local files. Artifact is remote Google Slides deck.

- [ ] **Step 1: Create the presentation via MCP**

Call `mcp__google-workspace__createPresentation` with:

```json
{
  "account": "personal",
  "title": "Академия Героев × Циркуль — Презентация родителям (2026-04-27)"
}
```

Expected: returned presentation ID (`presentationId`). Record it — it's used in every subsequent slide task.

- [ ] **Step 2: Delete the default first slide**

`createPresentation` creates a default blank slide. List slides via `readPresentation`:

```json
{ "account": "personal", "presentationId": "<pres-id>" }
```

Find the default slide's object ID. Delete it via `deleteRange` with the slide range OR leave it and treat it as slide 0 (blank cover). Recommended: delete to start clean.

- [ ] **Step 3: Store presentation URL in plan file**

Append to the "Deliverables" section at the bottom of this plan:

```
Presentation: https://docs.google.com/presentation/d/<pres-id>/edit
Presentation ID: <pres-id>
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add docs/superpowers/plans/2026-04-23-parent-presentation-implementation.md
git commit -m "feat(presentation): create empty Google Slides deck + record URL"
```

---

## Task 7: Build Section 1 (slides 1-4) — Opening and hook

**Reference:** spec `docs/superpowers/specs/2026-04-23-parent-presentation-design.md`, Section 1.

For each slide: `addSlide` → `addTextToSlide` for title + body → optional `insertLocalImage` → add speaker notes. Copy all text content from the spec file verbatim (do not paraphrase — that was approved already).

- [ ] **Step 1: Slide 1 — Title**

Call `addSlide` (layout: `TITLE_AND_BODY` or `BLANK` — try `BLANK` for cover styling). Then:
- `addTextToSlide` with title text: `Академия Героев × Циркуль`
- `addTextToSlide` with subtitle: `Школьный день превращается в RPG-приключение`
- `addTextToSlide` with footer text: `Дмитрий. Папа двух девочек и сына. · Пилот для 6 класса · Май 2026`
- `insertLocalImage`: path `/Users/macbookm/Hero academy/hero-academy/Welcome image.png` as background or hero image
- Add speaker notes (copy from spec section "Слайд 1"):
> Здравствуйте. Меня зовут Дмитрий. Я папа двух дочек и сына. Следующие 15-18 минут я хочу показать, что именно мы предлагаем вашим детям попробовать две недели мая. Начну с личной истории — почему я вообще это делаю. Потом покажу, как это работает. Потом честно отвечу на тревоги. В конце — что решать вам.

- [ ] **Step 2: Slide 2 — Why I started this (placeholder for child-with-gamepad photo)**

- Title: `Почему я это затеял`
- Body (3 lines, no bullets — narrative):
  - `Я вырос с играми. Знаю их язык изнутри.`
  - `Видел, как дети сидят 3 часа за героем в игре — и не могут 15 минут за домашкой.`
  - `Понял: проблема не в детях и не в школе. Проблема — в языке.`
- Image: **placeholder** — add a text box "[Фото: Дмитрий в детстве с геймпадом]" in the image slot. Will be replaced in Task 12.
- Speaker notes — copy from spec Слайд 2 block verbatim.

- [ ] **Step 3: Slide 3 — Problem (statistics)**

- Title: `Дети уже умеют долго и усердно. Только не в школе.`
- Body (3 bullets):
  - `74% школьников 10-13 лет: «уроки скучно» (ВЦИОМ, 2024)`
  - `4+ часа/день — в Roblox, TikTok, YouTube`
  - `Те же дети 3 часа подряд качают героя в игре`
- Speaker notes — copy from spec Слайд 3 (including the self-note about verifying the ВЦИОМ source).

- [ ] **Step 4: Slide 4 — Terminology transformation (the main hook)**

- Title: `Мы не заменяем школу. Мы переводим её на язык игры.`
- Body: 2-column comparison table (use `insertTable` MCP tool if available; otherwise use text layout with two columns of text boxes). Rows:

| Школа | Академия Героев |
|---|---|
| Домашняя работа | Квест |
| Самостоятельная | Данжен |
| Контрольная | Битва с Боссом |
| Ошибка в задании | Урон герою |
| Правильный ответ | Опыт (XP) и золото |

- Footer text: `Программа не меняется. Оценки не меняются. Меняется одно — хочется ли это делать.`
- Speaker notes — copy from spec Слайд 4.

- [ ] **Step 5: Verify 4 slides exist in presentation**

Call `readPresentation` with the pres ID. Confirm exactly 4 slides (plus maybe 1 default; delete default if still present).

- [ ] **Step 6: Open presentation and visually review Section 1**

```bash
open "https://docs.google.com/presentation/d/<pres-id>/edit"
```

Check: titles render, no text cut off, images scale reasonably. Note any layout fixes needed — can be handled at the end or now.

- [ ] **Step 7: Commit plan update**

```bash
cd "/Users/macbookm/Hero academy"
git commit --allow-empty -m "feat(presentation): build Section 1 slides (1-4)"
```

---

## Task 8: Build Section 2 (slides 5-7) — Solution and core-loop

**Reference:** spec Section 2.

- [ ] **Step 1: Slide 5 — Student becomes a hero**

- Title: `Каждый ребёнок — герой`
- Body (bullets):
  - `Уровень и XP — виден прогресс`
  - `HP — падает с ошибками, восстанавливается успехами`
  - `Золото и артефакты — награды за квесты`
- Image: `insertLocalImage` with `/Users/macbookm/Hero academy/presentation-assets/screenshots/slide-5-hero-main.png`
- Speaker notes — copy from spec Слайд 5.

- [ ] **Step 2: Slide 6 — Typical school day (horizontal timeline)**

- Title: `2 минуты утром. Обычная школа. 2 минуты вечером.`
- Body (3 sections with icons):
  - `🌅 Утро (2 мин): посмотреть героя, надеть артефакты на день`
  - `📚 Весь день: обычные уроки, домашка, контрольная`
  - `🌆 Вечер (2 мин): увидеть результат — XP, золото, новые артефакты`
- No screenshot — this is conceptual. Use text-driven layout.
- Speaker notes — copy from spec Слайд 6.

- [ ] **Step 3: Slide 7 — "This is not a game you play"**

- Title: `Это не игра, в которую играют. Это стимул на языке ребёнка.`
- Body (3 key thoughts):
  - `Ребёнок не играет внутри приложения — он живёт обычной школой`
  - `Оценки, активность, контрольные автоматически превращаются в XP и золото`
  - `Приложение — отражение его дня, а не замена дня`
- Footer italic: `Мы добавили слой, который показывает прогресс на языке, который ребёнку нравится. Ничего больше.`
- Speaker notes — copy from spec Слайд 7.

- [ ] **Step 4: Review + commit**

```bash
open "https://docs.google.com/presentation/d/<pres-id>/edit"
```

Verify slides 5, 6, 7 render correctly.

```bash
cd "/Users/macbookm/Hero academy"
git commit --allow-empty -m "feat(presentation): build Section 2 slides (5-7)"
```

---

## Task 9: Build Section 3 (slides 8-16) — Mechanics with embedded fears

**Reference:** spec Section 3 (9 slides — biggest section).

For each slide below: title + bullets + bottom-line + speaker notes. Follow the spec verbatim.

- [ ] **Step 1: Slide 8 — XP & Gold (closes fear C)**

Title: `Опыт — это реальные знания`. Image: `screenshots/slide-8-quests.png`. Bullets, footer, speaker notes — copy from spec Слайд 8.

- [ ] **Step 2: Slide 9 — HP & mistakes (closes fear B part 1)**

Title: `Ошибка — не катастрофа. Это часть пути.`. Image: `screenshots/slide-9-hero-hp-detail.png`. Content per spec Слайд 9.

- [ ] **Step 3: Slide 10 — Artifacts collection**

Title: `Артефакты — то, ради чего возвращаются`. Image: `screenshots/slide-10-artifacts.png`. Content per spec Слайд 10.

- [ ] **Step 4: Slide 11 — Social artifacts (closes fear B part 2)**

Title: `Новая социальная роль — "герой класса"`. Image: use 4 class-artifact icons from `/Users/macbookm/Hero academy/hero-academy/public/assets/artifacts/`. To find them:

```bash
ls "/Users/macbookm/Hero academy/hero-academy/public/assets/artifacts/" | grep -i "fire"
```

Pick 4 icons matching Тепло Очага / Огненный Бум / Драконий Клад / Спичка Дружбы. Insert via `insertLocalImage` each. Content per spec Слайд 11.

- [ ] **Step 5: Slide 12 — Shop (closes fear E)**

Title: `Никаких настоящих денег в игре у ребёнка. Сейчас и в пилоте.`. Image: `screenshots/slide-12-shop.png`. Content per spec Слайд 12.

- [ ] **Step 6: Slide 13 — Leaderboard (closes fear B part 3)**

Title: `Лидерборд, где никто не запирает 1 место`. Image: `screenshots/slide-13-leaderboard.png`. Content per spec Слайд 13.

- [ ] **Step 7: Slide 14 — Boss battle**

Title: `Контрольная = битва всего класса против общего босса`. Image: `screenshots/slide-14-boss-active.png`. Content per spec Слайд 14.

- [ ] **Step 8: Slide 15 — Parent dashboard (closes fear G)**

Title: `Для вас — вся картина в одном экране`. Image: `screenshots/slide-15-parent-dashboard.png`. Content per spec Слайд 15.

- [ ] **Step 9: Slide 16 — Privacy (closes fear D)**

Title: `Данные ребёнка — не товар. Ни сейчас, ни потом.`. No screenshot — use icon-based layout (server icon, lock, EU map). Content per spec Слайд 16.

- [ ] **Step 10: Review + commit**

```bash
open "https://docs.google.com/presentation/d/<pres-id>/edit"
```

Walk through slides 8-16. Verify all 8 screenshots rendered at readable size.

```bash
cd "/Users/macbookm/Hero academy"
git commit --allow-empty -m "feat(presentation): build Section 3 slides (8-16) with in-game screenshots"
```

---

## Task 10: Build Section 4 (slides 17-19) — Pilot honesty + science + manifesto

**Reference:** spec Section 4.

- [ ] **Step 1: Slide 17 — Your class is among the first**

Title: `Мы запускаем Академию Героев впервые. И мы выбрали вас.`. Content per spec Слайд 17.

- [ ] **Step 2: Slide 18 — Simulation-first (4 archetypes table with Минималист and Стабильный)**

Title: `Мы не гадаем на живых детях. Мы симулируем до запуска.`. Body:

- **4 archetype names (verbatim — these replaced Лентяй and Середняк per user):**
  - Отличник (топ 10%)
  - Стабильный (50%)
  - Минималист (делает только минимум)
  - Кит (скупщик артефактов)
- **4 KPI metrics** as per spec
- Speaker notes — copy from spec Слайд 18 (ensure the Минималист/Стабильный language is used, NOT Лентяй/Середняк).

- [ ] **Step 3: Slide 19 — "I'm building this for my children" (emotional peak, family photo placeholder)**

Title (large font): `Я создаю это в первую очередь для своих детей.`
Body (4 manifesto lines, one per paragraph, NOT bullets):
- `Я вижу каждое утро, как моим детям тяжело взяться за школу.`
- `И тот же вечер — как они часами готовы качать персонажа.`
- `Я делаю эту систему для них. Чтобы школа стала тем, что хочется открывать утром.`
- `И я очень хочу, чтобы она была доступна не только им — а всем детям, которым сейчас скучно.`

Bottom (large): `Ваш класс — первый, кому я это доверяю. Спасибо.`

Image: **placeholder** — text box "[Фото семьи Дмитрия — будет добавлено]". To be replaced in Task 12.

Speaker notes — copy from spec Слайд 19 verbatim.

- [ ] **Step 4: Review + commit**

```bash
cd "/Users/macbookm/Hero academy"
git commit --allow-empty -m "feat(presentation): build Section 4 slides (17-19)"
```

---

## Task 11: Build Section 5 (slides 20-22) — CTA + Q&A + finale

**Reference:** spec Section 5.

- [ ] **Step 1: Slide 20 — CTA with QR code**

Title: `Подтвердите согласие — это 2 минуты`
Body (3 steps):
- `1️⃣ Отсканируйте QR → форма Google (3 вопроса)`
- `2️⃣ Подпишите согласие до 1 мая (чтобы ребёнок вошёл в игру 4 мая)`
- `3️⃣ Передумали в процессе — отзываете одним сообщением, без бюрократии`

Image: `insertLocalImage` with `/Users/macbookm/Hero academy/presentation-assets/qr-consent.png` — large, centered.

Below QR, add short URL text (from Task 2).

Footer: `Нет согласия = ребёнок учится как обычно. Это честно и ничего не ломает.`

Speaker notes — copy from spec Слайд 20.

- [ ] **Step 2: Slide 21 — Q&A**

Title: `Ваши вопросы`
Body:
- `💬 Напишите в чат Zoom`
- `🎤 Или включите микрофон`
- `📧 Что не успеем — пришлю в родительский чат сегодня вечером`

Speaker notes — copy from spec Слайд 21.

- [ ] **Step 3: Slide 22 — Thank you + contact (family photo placeholder)**

Title: `Спасибо, что доверяете.`
Body:
- QR code (second insertion of `presentation-assets/qr-consent.png`, smaller than on slide 20)
- Text box: `Telegram: [placeholder]`
- Text box: `Почта: [placeholder]`
- Text box: `Старт 4 мая · Финал 25 мая · Общий разбор — конец мая`

Image: **placeholder** — text box "[Фото семьи Дмитрия]".

Footer: `Увидимся с результатами.`

Speaker notes — copy from spec Слайд 22.

- [ ] **Step 4: Verify count**

Call `readPresentation` with pres ID. Confirm exactly **22 slides**.

- [ ] **Step 5: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git commit --allow-empty -m "feat(presentation): build Section 5 slides (20-22) with QR code"
```

---

## Task 12: Finalize — replace photo placeholders, contacts, final review

**Blocking:** requires user to provide childhood photo, family photo, Telegram handle, email. Also requires user's approval of the source statistic on slide 3.

- [ ] **Step 1: Wait for user deliverables**

User provides:
- Childhood photo with gamepad → save to `presentation-assets/photo-dmitry-childhood.jpg`
- Family photo → save to `presentation-assets/photo-dmitry-family.jpg`
- Telegram handle → will be hardcoded into slides 22
- Email → will be hardcoded into slide 22
- Confirmation of the "74%/ВЦИОМ 2024" stat OR an alternative to use on slide 3

- [ ] **Step 2: Replace placeholder on Slide 2 with childhood photo**

- Delete the text placeholder "[Фото: Дмитрий в детстве с геймпадом]" via `deleteRange`
- `insertLocalImage` with `presentation-assets/photo-dmitry-childhood.jpg`

- [ ] **Step 3: Replace placeholder on Slide 19 with family photo**

Same as Step 2 but with `presentation-assets/photo-dmitry-family.jpg`.

- [ ] **Step 4: Replace placeholder on Slide 22 with family photo**

Same as Step 2 but with a smaller version of the family photo (or same image, Slides will scale).

- [ ] **Step 5: Replace contact placeholders on Slide 22**

- Replace "[placeholder]" in Telegram text box with actual handle (e.g., `@dmitry_circul`)
- Replace "[placeholder]" in Почта text box with actual email

- [ ] **Step 6: Confirm/replace the stat on Slide 3**

- If user supplies a real source → update body text and speaker notes
- If user says "leave as is" → no change
- If user says "remove" → delete that bullet, reformat

- [ ] **Step 7: Final walkthrough**

```bash
open "https://docs.google.com/presentation/d/<pres-id>/edit"
```

User walks through all 22 slides in presentation mode (Cmd+Enter in Slides) from start to finish, timing delivery. Expected duration: 15-18 minutes for slides 1-19 + 2-3 min for CTA + Q&A time.

**Red flags to catch:**
- Any image that didn't render
- Any text cut off or overlapping
- Speaker notes that are missing (check via "View → Notes")
- Slide transitions that feel abrupt (merge or add a pause slide if needed)

- [ ] **Step 8: Get the final shareable link**

Call `mcp__google-workspace__getShareableLink` with the pres ID, permission: view-only for the teacher + parent audience.

- [ ] **Step 9: Store final URL + form + deliverables below**

Update "Deliverables" section at bottom of this plan.

- [ ] **Step 10: Final commit**

```bash
cd "/Users/macbookm/Hero academy"
git add presentation-assets/ docs/superpowers/plans/
git commit -m "feat(presentation): finalize with family photos, contacts, sharing link"
```

---

## Deliverables

_(To be filled in as tasks complete)_

- Consent form URL: https://docs.google.com/forms/d/e/1FAIpQLScC3W8PX1N6fwBh38euGwImk6MN2iefawjnagGEukDpdo7ITA/viewform
- Consent form ID: 19QIYkZwId3bQX-CfgnBUyM6TBvhMyglBSsPKwD9-BeA
- Presentation URL:
- Presentation ID:
- Childhood photo path:
- Family photo path:
- Telegram:
- Email:
