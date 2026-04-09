# Удаление школы с каскадом — Design

**Дата:** 2026-04-09
**Статус:** Approved

## Проблема

В админке `/admin/schools` нельзя удалить школу. БД имеет асимметричные каскады:

- `classes.school_id → schools ON DELETE CASCADE` ✓
- `seasons.school_id → schools ON DELETE CASCADE` ✓
- `season_bosses.school_id → schools ON DELETE CASCADE` ✓
- `news.target_school_id → schools ON DELETE CASCADE` ✓
- `users.school_id → schools ON DELETE SET NULL` ⚠️

Прямой `DELETE FROM schools` оставит пользователей как «сирот» (school_id=null), а их auth-аккаунты в Supabase Auth останутся нетронутыми.

## Решение

### 1. API: `POST /api/admin/delete-school`

Новый роут по образцу `delete-user/route.ts`, использует `SUPABASE_SERVICE_ROLE_KEY`.

**Вход:** `{ school_id: string }`

**Алгоритм:**
1. `SELECT id FROM users WHERE school_id = X` — все пользователи школы (students, teachers, parents).
2. Для каждого `user_id` — полная зачистка в том же порядке, что `delete-user`:
   - получить `heroes.id` по `user_id`
   - удалить `hero_stats`, `hero_artifacts`, `activity_log` по `hero_id`
   - удалить `heroes` по `user_id`
   - удалить `quest_attempts`, `boss_participants` по `hero_id`
   - `UPDATE users SET parent_id = NULL WHERE parent_id = user_id`
   - удалить `users` по `id`
   - `auth.admin.deleteUser(user_id)`
3. `DELETE FROM schools WHERE id = X` — каскад снесёт classes, seasons, season_bosses, news.

**Возврат:** `{ success: true, deleted_users: N }` или `{ error: string }`.

### 2. Хук: `useAdminData.deleteSchool(id)`

Новый метод в `src/lib/hooks/use-admin-data.ts`:
- POST `/api/admin/delete-school`
- после успеха: `fetchSchools()`, `fetchClasses()`, `fetchUsers()`
- возвращает `{ error: string | null, deleted_users?: number }`

### 3. UI: карточка школы в `/admin/schools/page.tsx`

- Рядом с кнопкой ✏️ добавить красную кнопку 🗑️ (использовать стиль `btnEdit` с красным фоном)
- Клик (с `e.stopPropagation()`) → `window.confirm('Удалить школу "{name}"? Будут безвозвратно удалены все ученики, учителя, их герои и классы.')`
- Если подтверждено → вызов `deleteSchool(s.id)`, показ feedback `✅ Школа и N пользователей удалены` или ошибки
- Если удалённая школа была выбрана — сбросить `selectedSchool` и `expandedClass`

## Тесты

Новый симуляционный скрипт `scripts/test-delete-school.ts`:
1. Создать тестовую школу через `schools.insert`
2. Создать 2 класса, 3 учеников, 1 учителя (через API create-user)
3. Вызвать `POST /api/admin/delete-school`
4. Проверить: `schools`, `classes`, `users` (по school_id), `heroes` — всё удалено
5. Проверить: `auth.users` (по id) — удалены

## Вне скопа

- Soft delete / архивация (не нужна, консистентно с `delete-user`)
- RLS проверки (admin роут использует service role key, как другие admin роуты)
- UI undo (невозможно технически после каскада)
