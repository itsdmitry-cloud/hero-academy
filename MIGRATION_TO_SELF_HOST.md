# Миграция Hero Academy с Supabase Cloud → Self-Hosted

**Адресат:** Георгий (IT-специалист)
**Заказчик:** Дмитрий (владелец проекта)
**Дата:** 2026-05-14
**Окно миграции:** строго **после 26 мая 2026** (до 26-го идёт альфа-тест в школе, простой недопустим)

---

## 1. Зачем миграция

Текущая БД — на **Supabase Cloud, регион `aws-1-eu-north-1` (Stockholm)**. Российские мобильные операторы (МТС/Билайн/Мегафон/Теле2) **блокируют домен `*.supabase.co` на LTE без VPN**. Это полный блокер для альфы и любого живого использования в РФ.

**Цель:** перенести всю инфраструктуру на VPS в России. После переезда:
- никаких VPN у учеников и учителей
- latency БД ↔ приложение < 5 мс (всё в одном ДЦ)
- полный контроль над данными

---

## 2. Что есть сейчас (исходная инфраструктура)

### 2.1 Приложение

- **Hero Academy** — Next.js 16.1.6 (App Router, React 19, TypeScript)
- Рабочая директория: `/Users/macbookm/Hero academy/hero-academy/`
- Деплой: **Vercel** (framework: Next.js, см. `vercel.json`)
- Репозиторий: git, ветка `main`
- Менеджер пакетов: npm
- Зависимости БД: `@supabase/ssr ^0.9.0`, `@supabase/supabase-js ^2.99.1`, `pg ^8.20.0`
- Состояние: `zustand`, серверные компоненты + клиентские хуки

### 2.2 Supabase Cloud (источник)

- **Проект:** `gjezmurskhjngbostltn.supabase.co`
- **Регион:** `aws-1-eu-north-1` (Stockholm)
- **Pooler:** `aws-1-eu-north-1.pooler.supabase.com:5432`
- **Тарифный план:** уточнить (предположительно Free или Pro)

**Что используется из стека Supabase:**

| Компонент | Используется? | Где / для чего |
|-----------|---------------|----------------|
| **Postgres** | ✅ да | Основная БД, ~30+ таблиц |
| **Auth (GoTrue)** | ✅ да | Email/password + JWT, ~10-20 пользователей сейчас |
| **PostgREST** | ✅ да | Через `supabase-js`, активно |
| **Realtime (WebSocket)** | ✅ да | Live Radar учителя, hero updates, boss updates, class realtime |
| **Storage** | ⚠️ почти нет | Только один bucket `news` для картинок к новостям |
| **Edge Functions** | ❌ нет | Не используются (вся логика в Next.js API routes) |
| **pg_extensions** | минимум | Только дефолтные (`pgcrypto`/`uuid-ossp` могут быть нужны для `gen_random_uuid()`) |

### 2.3 Файлы и переменные окружения

`.env.local` в `hero-academy/`:
```
NEXT_PUBLIC_SUPABASE_URL=<URL проекта>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<публичный anon JWT>
SUPABASE_SERVICE_ROLE_KEY=<приватный service_role JWT>
DATABASE_URL=<прямой postgres connection string>
SUPABASE_ACCESS_TOKEN=<для CLI операций>
```

⚠️ Эти секреты — **в `.env.local`, в git не закоммичены**. Передавать только защищённым каналом (1Password / зашифрованный архив).

### 2.4 Схема БД

- **Миграции SQL:** `hero-academy/supabase/migrations/` — **26 файлов** `.sql` (нумерация `001_*` … `20260505_*`)
- **Seed:** `hero-academy/supabase/seed.sql`
- **Документация схемы:** `hero-academy/DATABASE_SCHEMA.md`

**Ключевые таблицы (полный список увидишь после `\dt`):**
- `auth.users` — пользователи (управляется GoTrue)
- `profiles`, `classes`, `schools` — организационная иерархия
- `heroes` — игровые персонажи учеников
- `subjects`, `quests`, `quest_grades` — учебная активность
- `artifacts`, `artifact_drops`, `hero_artifacts`, `artifact_slots` — RPG-предметы
- `lootboxes`, `lootbox_rewards` — рандомные награды
- `subject_bosses`, `boss_events`, `boss_participants`, `boss_damage_logs` — рейды
- `seasons`, `season_artifacts`, `season_rewards` — сезонные циклы
- `economy_config` — JSONB-конфиг мультипликаторов (XP/gold/dmg/drop)
- `streak_rewards`, `level_system`, `class_rank` — прогрессия
- `admin_logs`, `news` — административные

Все таблицы покрыты **RLS-политиками** (Row Level Security). Без них приложение работать не будет.

### 2.5 Особенность с миграциями

`npx supabase db push --linked` **сломан** из-за рассинхрона `supabase_migrations.schema_migrations` — пытается применить уже применённое и падает на `CREATE TYPE existing`.

**Рабочий способ применения миграций** — напрямую через `pg`:
```ts
// hero-academy/scripts/apply-rls-migration.ts (готовый шаблон)
import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sqlFromMigrationFile);
await client.end();
```

На локальной машине `psql` и `brew` **не установлены** — все операции с БД делаются через Node-скрипты с пакетом `pg` (он уже в зависимостях).

---

## 3. Что будем строить (целевая инфраструктура)

### 3.1 VPS

- **Провайдер на выбор:** Selectel / Timeweb Cloud / Yandex Cloud / VK Cloud
  - Рекомендация: **Selectel** (Москва или СПб) — гибко, дёшево, хорошие диски
- **Конфигурация (старт):**
  - 4 vCPU, 8 GB RAM, 80 GB NVMe SSD
  - Ubuntu 22.04 LTS
  - ~1500–2500 ₽/мес
- **Сеть:**
  - Публичный IPv4
  - Открыть порты: 22 (SSH, только по ключу), 80, 443
  - **Закрыть** 5432 наружу, кроме whitelist IP админа
- **Бэкап:** включить ежедневные снапшоты диска у провайдера

### 3.2 Домен и SSL

- Купить домен (или поддомен) для API: например `api.heroacademy.ru` или `db.heroacademy.ru`
  - Регистратор: **RU-CENTER** или **Reg.ru**
- DNS: A-запись → IP VPS
- SSL: **Let's Encrypt через certbot** (НЕ Cloudflare — нестабилен в РФ)

### 3.3 Self-hosted Supabase stack

Деплой через официальный `docker-compose` из `github.com/supabase/supabase/tree/master/docker`.

Состав контейнеров:
- `postgres` (Postgres 15 + extensions)
- `gotrue` (auth, JWT issuer)
- `postgrest` (REST API)
- `realtime` (WebSocket поверх Postgres replication)
- `storage-api` (файлы поверх S3-совместимого backend)
- `kong` (API gateway, валидация ключей)
- `studio` (веб-UI как на supabase.com, попроще)
- `meta` (служебный для Studio)
- `imgproxy` (image transforms, опционально)
- `edge-runtime` (Deno, не используем — можно убрать из compose)

**Reverse proxy:** nginx или Caddy перед Kong, выдаёт SSL и проксирует:
- `https://api.heroacademy.ru/auth/v1/*` → gotrue
- `https://api.heroacademy.ru/rest/v1/*` → postgrest
- `https://api.heroacademy.ru/realtime/v1/*` → realtime (WS)
- `https://api.heroacademy.ru/storage/v1/*` → storage
- `https://studio.heroacademy.ru` → studio (защитить basic-auth)

### 3.4 Storage backend

- Bucket `news` (единственный используемый): хранить локально на диске VPS в `/var/lib/supabase/storage` (через volume)
- Альтернатива: Yandex Object Storage / Selectel S3 для бэкапов и масштабирования

### 3.5 Бэкапы

- `pg_dump` по cron каждые 6 часов → локально + в Yandex Object Storage
- Retention: 7 дней daily + 4 weekly + 3 monthly
- Скрипт восстановления готовый и проверенный (тестовый restore раз в месяц)

---

## 4. План миграции (пошагово)

> ⚠️ **ВРЕМЕННЫЕ РАМКИ:** начало работ — не раньше **27 мая 2026**. До этого идёт альфа-тест, любой простой = провал. К **1 июня** должно быть всё в проде.

### Этап 1. Подготовка инфраструктуры (день 1)

1. Заказать VPS у Selectel (или согласованного провайдера)
2. Настроить SSH-доступ по ключу, запретить пароли (`PasswordAuthentication no` в `sshd_config`)
3. Установить базовый софт: `docker`, `docker-compose`, `nginx`, `certbot`, `pg_dump`-клиент
4. Создать unprivileged user `supabase`, добавить в группу `docker`
5. Настроить firewall (`ufw`): allow 22, 80, 443; deny остальное
6. Купить домен / настроить поддомен, A-запись → IP VPS
7. `certbot --nginx -d api.heroacademy.ru -d studio.heroacademy.ru` — получить SSL

### Этап 2. Развёртывание self-hosted Supabase (день 2)

1. `git clone https://github.com/supabase/supabase`
2. `cd supabase/docker`
3. Сгенерировать новые JWT-ключи:
   ```bash
   # JWT_SECRET (40+ символов)
   openssl rand -base64 64
   # затем через https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
   # сгенерировать ANON_KEY и SERVICE_ROLE_KEY на основе JWT_SECRET
   ```
4. Заполнить `.env` (важно: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL, API_EXTERNAL_URL, SMTP — для подтверждения email при регистрации)
5. `docker compose up -d`
6. Проверить healthcheck всех контейнеров: `docker compose ps`
7. Открыть Studio через nginx-прокси, убедиться что админка работает
8. Настроить nginx-конфиг с правильным проксированием путей (см. п.3.3)

### Этап 3. Снятие дампа с Supabase Cloud (день 3, первая половина)

⚠️ Делать в момент **минимальной активности пользователей** (ночь, выходные).

1. На локальной машине / на новом VPS выполнить:
   ```bash
   # Полный дамп схемы (включая auth.* и storage.*)
   pg_dump "$DATABASE_URL" \
     --no-owner --no-privileges \
     --schema=public --schema=auth --schema=storage \
     -f hero_academy_full.sql

   # Отдельно схема (для проверки структуры)
   pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges -f schema_only.sql

   # Отдельно данные
   pg_dump "$DATABASE_URL" --data-only --no-owner --no-privileges -f data_only.sql
   ```
2. Storage bucket `news`: выгрузить через Supabase Storage API (curl + service_role_key) или `supabase storage download` CLI — файлов мало, можно вручную.

### Этап 4. Восстановление на self-hosted (день 3, вторая половина)

1. На новом VPS:
   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres < hero_academy_full.sql
   ```
2. **КРИТИЧНО:** проверить, что таблицы `auth.users` восстановились вместе с хэшами паролей. Bcrypt-хэши совместимы между cloud и self-hosted GoTrue — пользователи войдут со старыми паролями.
3. Прогнать все миграции из `hero-academy/supabase/migrations/` через `scripts/apply-rls-migration.ts` — для проверки соответствия схемы (если уже применены — увидим конфликты, разрешим вручную).
4. Загрузить файлы из bucket `news` в `/var/lib/supabase/storage/news/`
5. Проверить через Studio: таблицы есть, данные на месте, RLS-политики применены, пользователи есть.

### Этап 5. Тестовый прогон приложения (день 4)

1. Создать ветку `feat/self-hosted-migration` в репозитории
2. В **новом `.env.local`** (локально на машине разработчика) подменить:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://api.heroacademy.ru
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<новый anon key>
   SUPABASE_SERVICE_ROLE_KEY=<новый service_role>
   DATABASE_URL=postgresql://postgres:<pwd>@api.heroacademy.ru:5432/postgres
   ```
3. `npm run dev` — поднять локально, прогнать сценарии:
   - Вход учителя
   - Вход ученика
   - Получение урона, дроп артефакта
   - Атака по боссу
   - Live Radar (Realtime!)
   - Загрузка картинки в новости (Storage)
4. Запустить тесты: `npm run test`
5. Прогнать build: `npm run build` — ошибок быть не должно

### Этап 6. Деплой Next.js (день 5)

**Вариант A — оставить Vercel** (проще, но есть cross-border latency US ↔ RU)
- Обновить env vars в Vercel Dashboard
- Redeploy
- Минус: каждый SSR-запрос летит из Vercel (US/EU) в нашу БД в РФ — +50-150ms на запрос

**Вариант B (рекомендуется) — Next.js на том же VPS**
- Поставить `node 20`, `pm2`
- Склонировать репо, `npm ci && npm run build`
- `pm2 start npm --name hero-academy -- start`
- nginx-прокси с SSL: `https://heroacademy.ru` → `localhost:3000`
- Latency приложение ↔ БД: ~1 мс

### Этап 7. Переключение трафика (день 5, финал)

1. Финальный pg_dump из Supabase Cloud (свежий)
2. Restore в self-hosted (поверх предыдущего тестового — `DROP SCHEMA public CASCADE` + restore)
3. DNS-переключение / смена env vars в проде
4. Прогон smoke-тестов
5. Сообщить пользователям (1-2 учителя, 10 учеников) о переходе

### Этап 8. Бэкапы и мониторинг (день 5-6)

1. Cron-скрипт `pg_dump` каждые 6 часов в `/var/backups/postgres/`
2. Загрузка в Yandex Object Storage (rclone)
3. Uptime monitoring: **uptime-kuma** в Docker (бесплатно, self-hosted)
4. Alerts в Telegram при падении любого контейнера
5. Логи через `docker logs` + `logrotate`

---

## 5. Что обязательно сохранить из Supabase Cloud

Перед удалением проекта в cloud:
- ✅ Полный `pg_dump` (схема + данные)
- ✅ Все JWT-ключи (на случай отката)
- ✅ Storage bucket `news` (все файлы)
- ✅ Скриншот настроек Auth (Email templates, redirects)
- ✅ Скриншот настроек Storage (политики bucket)
- ✅ Список всех Database Webhooks (если есть)
- ✅ Список Database Functions с триггерами

**Supabase Cloud проект НЕ удалять минимум 2 недели** после миграции — на случай отката.

---

## 6. Что переписывать в коде Hero Academy (минимум)

В идеале — **ничего**. `@supabase/supabase-js` работает с любым URL.

Места, где задаётся URL/keys (для понимания):
- `hero-academy/src/lib/supabase/client.ts` — клиент для браузера
- `hero-academy/src/lib/supabase/server.ts` — клиент для SSR
- `hero-academy/src/lib/supabase/middleware.ts` — Next.js middleware (auth refresh)
- `hero-academy/src/lib/supabase/auth-context.tsx` — React-контекст auth

Все они читают `process.env.NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Меняем только env, код не трогаем.

**Важно соблюдать singleton-паттерн** в `client.ts` — он уже соблюдён. Если случайно сломается, мобильные клиенты тормозят из-за множества WebSocket-соединений.

---

## 7. Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Сломаются JWT, пользователи не войдут | средняя | Сразу после restore проверить login на тестовом аккаунте |
| Realtime не подключится (WS-прокси) | средняя | nginx с `proxy_http_version 1.1` + `Upgrade` headers, проверить через Live Radar |
| RLS-политики не восстановятся | низкая | Прогнать миграции `006_indexes_rls.sql` поверх, проверить через `scripts/verify-*.ts` |
| Storage-файлы потеряются | низкая | Перед переключением проверить наличие всех файлов |
| DNS не обновится у пользователей (TTL) | высокая | Снизить TTL до 300 за день до переключения |
| VPS упадёт в первые дни | средняя | Снапшоты + alerts; держать Supabase Cloud живым 2 недели для отката |
| Email подтверждения регистрации не уходят | высокая | Настроить SMTP (Resend / Mailgun / Яндекс.Почта для бизнеса) в `.env` self-hosted |
| Кто-то найдёт открытый 5432 | средняя | UFW deny + только whitelist админа |

---

## 8. Что НЕ надо делать

- ❌ Не использовать Cloudflare для SSL — нестабилен в РФ
- ❌ Не оставлять Postgres-порт открытым в интернет
- ❌ Не запускать всё под root в Docker
- ❌ Не удалять Supabase Cloud проект сразу после миграции
- ❌ Не делать миграцию во время рабочего дня школы (только ночь / выходные)
- ❌ Не пытаться использовать `supabase db push --linked` — он сломан, см. п.2.5
- ❌ Не коммитить `.env` файлы в git

---

## 9. Контакты и каналы

- **Дмитрий** (владелец): доступ к Vercel, Supabase Cloud, репо, доменам
- **Георгий** (IT-спец): доступ к VPS, Docker, БД (после переезда)
- Передача секретов: **только через 1Password / зашифрованный архив** (не Telegram, не почта)

---

## 10. Что делать прямо сейчас Георгию

1. Прочитать этот документ целиком
2. Задать вопросы Дмитрию (особенно по выбору провайдера VPS и домена)
3. Дождаться окончания альфы (26 мая)
4. По готовности — начать с **Этапа 1** (подготовка инфраструктуры)
5. После каждого этапа — короткий статус Дмитрию

---

**Готовый объём работ: 5–6 рабочих дней**. Бюджет инфраструктуры: ~2000-3000 ₽/мес VPS + ~500-1000 ₽/год домен.
