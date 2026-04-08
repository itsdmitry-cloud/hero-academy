import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEMO_NAME = 'Демо Герой';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Fake classmates for leaderboard
const CLASSMATES = [
  { name: 'Артём Волков',      gender: 'male',   level: 50, xp: 8500, gold: 5200, streak: 30, hp: 100 },
  { name: 'Мария Соколова',    gender: 'female', level: 47, xp: 7800, gold: 4100, streak: 21, hp: 95 },
  { name: 'Даниил Петров',     gender: 'male',   level: 44, xp: 7200, gold: 3500, streak: 14, hp: 82 },
  { name: 'Алиса Иванова',     gender: 'female', level: 42, xp: 6500, gold: 3800, streak: 10, hp: 100 },
  { name: 'Кирилл Смирнов',    gender: 'male',   level: 38, xp: 5400, gold: 2200, streak: 7,  hp: 55 },
  { name: 'Софья Козлова',     gender: 'female', level: 35, xp: 4800, gold: 2900, streak: 5,  hp: 100 },
  { name: 'Максим Новиков',    gender: 'male',   level: 30, xp: 3900, gold: 1500, streak: 3,  hp: 70 },
  { name: 'Ева Морозова',      gender: 'female', level: 28, xp: 3400, gold: 1800, streak: 8,  hp: 90 },
  { name: 'Тимур Лебедев',     gender: 'male',   level: 25, xp: 2800, gold: 1100, streak: 2,  hp: 40 },
  { name: 'Полина Федорова',   gender: 'female', level: 22, xp: 2200, gold: 900,  streak: 4,  hp: 78 },
  { name: 'Егор Васильев',     gender: 'male',   level: 18, xp: 1600, gold: 600,  streak: 1,  hp: 60 },
  { name: 'Виктория Попова',   gender: 'female', level: 15, xp: 1200, gold: 450,  streak: 0,  hp: 85 },
  { name: 'Роман Кузнецов',    gender: 'male',   level: 12, xp: 850,  gold: 300,  streak: 0,  hp: 35 },
  { name: 'Анна Николаева',    gender: 'female', level: 8,  xp: 500,  gold: 200,  streak: 1,  hp: 100 },
];

const DEMO_QUESTS = [
  { title: 'Дроби и проценты',         subject: 'Математика',  type: 'quest' as const, difficulty: 'medium' as const, xp_reward: 150, gold_reward: 20, hp_damage: 10, daysUntil: 1,  status: 'active' as const },
  { title: 'Past Simple — упражнения', subject: 'Английский',  type: 'quest' as const, difficulty: 'easy' as const,   xp_reward: 100, gold_reward: 10, hp_damage: 5,  daysUntil: 2,  status: 'active' as const },
  { title: 'Площади фигур',            subject: 'Геометрия',   type: 'quest' as const, difficulty: 'hard' as const,   xp_reward: 250, gold_reward: 40, hp_damage: 15, daysUntil: 3,  status: 'active' as const },
  { title: 'Части речи',               subject: 'Русский',     type: 'quest' as const, difficulty: 'easy' as const,   xp_reward: 100, gold_reward: 10, hp_damage: 5,  daysUntil: 0,  status: 'active' as const },
  { title: 'Природные зоны',           subject: 'География',   type: 'quest' as const, difficulty: 'medium' as const, xp_reward: 150, gold_reward: 20, hp_damage: 10, daysUntil: -1, status: 'active' as const },
  { title: 'Басни Крылова',            subject: 'Литература',  type: 'quest' as const, difficulty: 'easy' as const,   xp_reward: 100, gold_reward: 15, hp_damage: 5,  daysUntil: 5,  status: 'active' as const },
];

const DEMO_ACTIVITY = [
  { action: 'quest_complete',     xp: 150,  hp: 0,    gold: 20,  hoursAgo: 2,   meta: { quest: 'Уравнения', subject: 'Математика', grade: 5 } },
  { action: 'teacher_xp_grant',   xp: 100,  hp: 0,    gold: 15,  hoursAgo: 5,   meta: { reason: 'Активность на уроке', subject: 'Физика' } },
  { action: 'boss_damage',        xp: 80,   hp: -10,  gold: 0,   hoursAgo: 8,   meta: { boss: 'Дракон Алгебры', damage: 80 } },
  { action: 'shop_purchase',      xp: 0,    hp: 0,    gold: -50, hoursAgo: 12,  meta: { item: 'Малое зелье HP', category: 'hp_potion' } },
  { action: 'streak_reward',      xp: 250,  hp: 0,    gold: 50,  hoursAgo: 24,  meta: { streak: 7, milestone: '7 дней' } },
  { action: 'quest_complete',     xp: 250,  hp: -15,  gold: 40,  hoursAgo: 26,  meta: { quest: 'Контрольная: дроби', subject: 'Математика', grade: 4 } },
  { action: 'artifact_drop',      xp: 0,    hp: 0,    gold: 0,   hoursAgo: 28,  meta: { artifact: 'Щит стража', rarity: 'rare' } },
  { action: 'teacher_xp_grant',   xp: 80,   hp: 0,    gold: 10,  hoursAgo: 48,  meta: { reason: 'Доклад на уроке', subject: 'История' } },
  { action: 'boss_damage',        xp: 120,  hp: -5,   gold: 0,   hoursAgo: 50,  meta: { boss: 'Дракон Алгебры', damage: 120 } },
  { action: 'quest_complete',     xp: 100,  hp: 0,    gold: 10,  hoursAgo: 72,  meta: { quest: 'Глаголы движения', subject: 'Английский', grade: 5 } },
  { action: 'potion_used',        xp: 0,    hp: 25,   gold: 0,   hoursAgo: 73,  meta: { artifact: 'Малое зелье HP' } },
  { action: 'level_up',           xp: 0,    hp: 0,    gold: 0,   hoursAgo: 96,  meta: { new_level: 12, old_level: 11 } },
  { action: 'quest_complete',     xp: 150,  hp: -10,  gold: 20,  hoursAgo: 100, meta: { quest: 'Строение клетки', subject: 'Биология', grade: 4 } },
  { action: 'boss_kill_reward',   xp: 300,  hp: 0,    gold: 50,  hoursAgo: 120, meta: { boss: 'Фантом Грамматики' } },
];

const DEMO_NEWS = [
  { title: 'Новый сезон начался!',                body: 'Сезон "Весна 2026" стартовал. Новые боссы, артефакты и награды ждут вас!', type: 'event' as const, pinned: true,  hoursAgo: 48 },
  { title: 'Стрик-челлендж',                      body: 'Кто продержит стрик 14 дней — получит эпический артефакт! Не пропускайте ДЗ.',    type: 'info' as const,  pinned: false, hoursAgo: 24 },
  { title: 'Артём Волков победил босса!',          body: 'Артём нанёс решающий удар Дракону Алгебры. Весь класс получил бонус XP!',          type: 'reward' as const,pinned: false, hoursAgo: 8 },
  { title: 'Новые предметы в магазине',            body: 'Добавлены сезонные сундуки и косметика. Загляните в магазин!',                     type: 'info' as const,  pinned: false, hoursAgo: 72 },
];

/**
 * POST /api/demo/setup
 * Body: { userId: string } — ID анонимного пользователя из signInAnonymously()
 * Провижнит все демо-данные для этого пользователя.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId: string | undefined = body?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // ── 1. Ensure school + class exist ──
    let schoolId: string;
    const { data: school } = await admin
      .from('schools').select('id').eq('name', 'Демо Школа').maybeSingle();
    if (school) {
      schoolId = school.id;
    } else {
      const { data: s, error: e } = await admin
        .from('schools').insert({ name: 'Демо Школа' }).select('id').single();
      if (e || !s) return NextResponse.json({ error: `School: ${e?.message}` }, { status: 500 });
      schoolId = s.id;
    }

    let classId: string;
    const { data: cls } = await admin
      .from('classes').select('id').eq('school_id', schoolId).eq('name', 'Демо 5А').maybeSingle();
    if (cls) {
      classId = cls.id;
    } else {
      const { data: c, error: e } = await admin
        .from('classes').insert({ school_id: schoolId, name: 'Демо 5А', invite_code: 'DEMO01' }).select('id').single();
      if (e || !c) return NextResponse.json({ error: `Class: ${e?.message}` }, { status: 500 });
      classId = c.id;
    }

    // ── 2. Ensure season exists ──
    let seasonId: string;
    const { data: season } = await admin
      .from('seasons').select('id').eq('school_id', schoolId).eq('status', 'active').maybeSingle();
    if (season) {
      seasonId = season.id;
    } else {
      const now = new Date();
      const end = new Date(now); end.setMonth(end.getMonth() + 3);
      const { data: s, error: e } = await admin.from('seasons').insert({
        school_id: schoolId, name: 'Весна 2026', status: 'active',
        starts_at: now.toISOString(), ends_at: end.toISOString(), created_by: null,
      }).select('id').single();
      if (e || !s) return NextResponse.json({ error: `Season: ${e?.message}` }, { status: 500 });
      seasonId = s.id;
    }

    // ── 3. Upsert user profile for this anonymous user ──
    await admin.from('users').upsert({
      id: userId, display_name: DEMO_NAME, role: 'student',
      school_id: schoolId, class_id: classId,
    });

    // ── 4. Upsert demo hero ──
    const { data: heroData, error: heroErr } = await admin.from('heroes').upsert({
      user_id: userId, name: DEMO_NAME, gender: 'male',
      level: 48, xp: 7200, xp_to_next: 8000,
      hp: 78, hp_max: 100, gold: 4500,
      streak_current: 12, streak_best: 21,
      streak_last_date: new Date().toISOString().split('T')[0],
      status: 'active', artifact_slots: 6,
      gold_multiplier: 1, xp_multiplier: 1, season_id: seasonId,
      season_xp: 10000,
    }, { onConflict: 'user_id' }).select('id').single();
    if (heroErr || !heroData) return NextResponse.json({ error: `Hero: ${heroErr?.message}` }, { status: 500 });
    const heroId = heroData.id;

    // ── 5. Hero stats (radar chart) ──
    await admin.from('hero_stats').upsert({
      hero_id: heroId,
      strength: 42, knowledge: 55, endurance: 38, luck: 28, wisdom: 48,
    }, { onConflict: 'hero_id' });

    // ── 6. Ensure NPC classmates exist (for leaderboard) ──
    const classmateHeroIds: string[] = [];
    for (const cm of CLASSMATES) {
      const cmEmail = `demo_${cm.name.replace(/\s/g, '').toLowerCase()}@hero.academy`;

      let cmUserId: string;
      const { data: cmAuth, error: cmAuthErr } = await admin.auth.admin.createUser({
        email: cmEmail, password: 'DemoNPC2026!', email_confirm: true,
      });
      if (cmAuth?.user) {
        cmUserId = cmAuth.user.id;
      } else if (cmAuthErr?.message?.includes('already been registered')) {
        const { data: cmProfile } = await admin
          .from('users').select('id').eq('display_name', cm.name).eq('class_id', classId).maybeSingle();
        if (!cmProfile) continue;
        cmUserId = cmProfile.id;
      } else {
        continue;
      }

      await admin.from('users').upsert({
        id: cmUserId, display_name: cm.name, role: 'student',
        school_id: schoolId, class_id: classId,
      });

      const { data: cmHero } = await admin.from('heroes').upsert({
        user_id: cmUserId, name: cm.name, gender: cm.gender,
        level: cm.level, xp: cm.xp, xp_to_next: 100 + cm.level * 100,
        hp: cm.hp, hp_max: 100, gold: cm.gold,
        streak_current: cm.streak, streak_best: cm.streak + 3,
        streak_last_date: new Date().toISOString().split('T')[0],
        status: 'active', season_id: seasonId,
      }, { onConflict: 'user_id' }).select('id').single();

      if (cmHero) {
        classmateHeroIds.push(cmHero.id);
        await admin.from('hero_stats').upsert({
          hero_id: cmHero.id,
          strength: 10 + Math.floor(cm.level * 0.8),
          knowledge: 10 + Math.floor(cm.level * 1.2),
          endurance: 10 + Math.floor(cm.level * 0.6),
          luck: 10 + Math.floor(cm.level * 0.5),
          wisdom: 10 + Math.floor(cm.level * 1.0),
        }, { onConflict: 'hero_id' });
      }
    }

    // ── 7. Clean old data for this hero and reprovision ──
    await admin.from('quests').delete().eq('class_id', classId).eq('created_by', userId);
    await admin.from('activity_log').delete().eq('hero_id', heroId);
    await admin.from('hero_artifacts').delete().eq('hero_id', heroId);
    await admin.from('achievements_unlocked').delete().eq('hero_id', heroId);
    await admin.from('transactions').delete().eq('hero_id', heroId);
    await admin.from('hero_season_rewards').delete().eq('hero_id', heroId);

    // ── 8. Create quests ──
    const now = Date.now();
    for (const q of DEMO_QUESTS) {
      const deadline = new Date(now + q.daysUntil * 86400000).toISOString();
      const { data: quest } = await admin.from('quests').insert({
        class_id: classId, created_by: userId,
        type: q.type, title: q.title, subject: q.subject,
        difficulty: q.difficulty, xp_reward: q.xp_reward,
        gold_reward: q.gold_reward, hp_damage: q.hp_damage,
        deadline, status: q.status, max_attempts: 1,
      }).select('id').single();

      if (!quest) continue;

      if (q.daysUntil <= 0) {
        await admin.from('quest_attempts').insert({
          quest_id: quest.id, hero_id: heroId,
          status: 'completed', correct_count: 8, mistake_count: 1,
          xp_earned: q.xp_reward, gold_earned: q.gold_reward, hp_lost: q.hp_damage,
          grade: q.daysUntil === 0 ? 5 : 4,
        });
      }
    }

    // ── 9. Inventory ──
    await provisionInventory(heroId);

    // ── 10. Activity log ──
    await admin.from('activity_log').insert(DEMO_ACTIVITY.map(a => ({
      user_id: userId, hero_id: heroId, action: a.action,
      metadata: a.meta, xp_change: a.xp, hp_change: a.hp, gold_change: a.gold,
      created_at: new Date(now - a.hoursAgo * 3600000).toISOString(),
    })));

    // ── 11. Transactions ──
    await admin.from('transactions').insert([
      { hero_id: heroId, type: 'reward' as const, item_type: 'xp', amount: 150, description: 'Квест: Уравнения', created_at: new Date(now - 2 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'gold', amount: 20, description: 'Квест: Уравнения', created_at: new Date(now - 2 * 3600000).toISOString() },
      { hero_id: heroId, type: 'purchase' as const, item_type: 'gold', amount: -50, description: 'Покупка: Малое зелье HP', created_at: new Date(now - 12 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'xp', amount: 250, description: 'Стрик 7 дней', created_at: new Date(now - 24 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'gold', amount: 50, description: 'Стрик 7 дней', created_at: new Date(now - 24 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'xp', amount: 300, description: 'Босс повержен: Фантом Грамматики', created_at: new Date(now - 120 * 3600000).toISOString() },
    ]);

    // ── 12. News ──
    // Only insert if not already present for this class (NPC news, not per-user)
    const { count: existingNews } = await admin.from('news')
      .select('*', { count: 'exact', head: true }).eq('target_class_id', classId);
    if (!existingNews || existingNews < 4) {
      await admin.from('news').delete().eq('target_class_id', classId);
      await admin.from('news').insert(DEMO_NEWS.map(n => ({
        title: n.title, body: n.body, type: n.type,
        target_type: 'class' as const, target_class_id: classId,
        pinned: n.pinned, created_by: userId,
        created_at: new Date(now - n.hoursAgo * 3600000).toISOString(),
      })));
    }

    // ── 13. Subject bosses ──
    const { data: existingBosses } = await admin.from('subject_bosses')
      .select('id').eq('class_id', classId).eq('season_id', seasonId);
    if (!existingBosses || existingBosses.length === 0) {
      const bossConfigs = [
        { subject_id: 'Математика', name: 'Дракон Алгебры', avatar: '🐉', max_hp: 5000, current_hp: 2800 },
        { subject_id: 'Английский', name: 'Фантом Грамматики', avatar: '👻', max_hp: 3000, current_hp: 3000 },
      ];
      for (const bc of bossConfigs) {
        const { data: boss } = await admin.from('subject_bosses').insert({
          season_id: seasonId, class_id: classId,
          subject_id: bc.subject_id, name: bc.name, avatar: bc.avatar,
          max_hp: bc.max_hp, current_hp: bc.current_hp, is_defeated: false,
        }).select('id').single();

        if (boss && bc.current_hp < bc.max_hp) {
          const dmgLogs = [
            { boss_id: boss.id, hero_id: heroId, damage_dealt: 800, action_type: 'homework', created_at: new Date(now - 8 * 3600000).toISOString() },
            { boss_id: boss.id, hero_id: heroId, damage_dealt: 400, action_type: 'lesson_mark', created_at: new Date(now - 50 * 3600000).toISOString() },
          ];
          for (let i = 0; i < Math.min(classmateHeroIds.length, 4); i++) {
            dmgLogs.push({
              boss_id: boss.id, hero_id: classmateHeroIds[i],
              damage_dealt: 200 + i * 100,
              action_type: i % 2 === 0 ? 'homework' : 'lesson_mark',
              created_at: new Date(now - (10 + i * 20) * 3600000).toISOString(),
            });
          }
          await admin.from('boss_damage_logs').insert(dmgLogs);
        }
      }
    }

    // ── 14. Battle Pass ──
    await admin.from('hero_season_rewards').insert(
      Array.from({ length: 16 }, (_, i) => ({
        hero_id: heroId, season_id: seasonId, tier: i + 1,
        claimed_at: new Date(now - (16 - i) * 24 * 3600000).toISOString(),
      }))
    );

    // ── 15. Achievements ──
    const { data: achievements } = await admin.from('achievements')
      .select('id, condition_type, condition_value')
      .in('condition_type', ['quests_completed', 'streak_days', 'bosses_killed', 'artifacts_collected', 'gold_total']);
    if (achievements) {
      const toUnlock = achievements.filter(a =>
        (a.condition_type === 'quests_completed' && a.condition_value <= 85) ||
        (a.condition_type === 'streak_days' && a.condition_value <= 21) ||
        (a.condition_type === 'bosses_killed' && a.condition_value <= 5) ||
        (a.condition_type === 'artifacts_collected' && a.condition_value <= 20) ||
        (a.condition_type === 'gold_total' && a.condition_value <= 8000)
      );
      if (toUnlock.length > 0) {
        await admin.from('achievements_unlocked').insert(
          toUnlock.map(a => ({ hero_id: heroId, achievement_id: a.id }))
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function provisionInventory(heroId: string) {
  const { data: artifacts } = await admin
    .from('artifacts').select('id, name, effect_type, rarity');
  if (!artifacts || artifacts.length === 0) return;

  const find = (name: string) => artifacts.find(a => a.name === name);
  const findEffect = (eff: string, rar?: string) =>
    artifacts.find(a => a.effect_type === eff && (!rar || a.rarity === rar));

  type Row = {
    hero_id: string; artifact_id: string; is_equipped: boolean;
    quantity: number; charges_remaining: number; source: string; slot_index: number | null;
  };
  const inv: Row[] = [];
  let slot = 0;

  const add = (art: { id: string } | undefined, equipped: boolean, qty: number, charges: number, source: string) => {
    if (!art) return;
    inv.push({
      hero_id: heroId, artifact_id: art.id, is_equipped: equipped,
      quantity: qty, charges_remaining: charges, source,
      slot_index: equipped ? slot++ : null,
    });
  };

  // Equipped (on shelf) — level 48 unlocks 5 slots
  add(find('Зелье опыта'),        true, 3, 3, 'drop');
  add(find('Щит стража'),         true, 2, 1, 'shop');
  add(find('Свеча Полуночника'),  true, 1, 1, 'streak_reward');
  add(find('Перо мудрости'),      true, 1, 1, 'drop');
  add(find('Корона героя'),       true, 1, 1, 'lootbox');

  // Backpack — potions
  add(find('Малое зелье HP'),     false, 8, 1, 'shop');
  add(find('Большое зелье HP'),   false, 5, 1, 'shop');
  add(find('Зелье опыта'),        false, 4, 3, 'reward');

  // Backpack — rare/epic/legendary items
  add(find('Мешок золота'),       false, 6, 1, 'reward');
  add(find('Сфера знаний'),       false, 2, 1, 'lootbox');
  add(find('Крест воскрешения'),  false, 1, 1, 'teacher_gift');
  add(find('Щит стража'),         false, 3, 1, 'drop');
  add(find('Свеча Полуночника'),  false, 2, 1, 'drop');
  add(find('Перо мудрости'),      false, 2, 1, 'reward');

  // Chests — lots to open
  add(findEffect('lootbox', 'common'),    false, 5, 1, 'reward');
  add(findEffect('lootbox', 'rare'),      false, 4, 1, 'reward');
  add(findEffect('lootbox', 'epic'),      false, 2, 1, 'drop');
  add(findEffect('lootbox', 'legendary'), false, 1, 1, 'teacher_gift');

  if (inv.length > 0) {
    await admin.from('hero_artifacts').insert(inv);
  }
}
