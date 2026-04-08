import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEMO_EMAIL = 'demo@hero.academy';
const DEMO_PASSWORD = 'DemoHero2026!';
const DEMO_NAME = 'Демо Герой';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Fake classmates for leaderboard
const CLASSMATES = [
  { name: 'Артём Волков',    gender: 'male',   level: 15, xp: 2100, gold: 1800, streak: 12, hp: 92 },
  { name: 'Мария Соколова',  gender: 'female', level: 14, xp: 1900, gold: 2200, streak: 9,  hp: 100 },
  { name: 'Даниил Петров',   gender: 'male',   level: 11, xp: 1200, gold: 900,  streak: 5,  hp: 65 },
  { name: 'Алиса Иванова',   gender: 'female', level: 10, xp: 1050, gold: 1100, streak: 3,  hp: 88 },
  { name: 'Кирилл Смирнов',  gender: 'male',   level: 8,  xp: 700,  gold: 400,  streak: 1,  hp: 45 },
  { name: 'Софья Козлова',   gender: 'female', level: 7,  xp: 550,  gold: 600,  streak: 2,  hp: 100 },
  { name: 'Максим Новиков',  gender: 'male',   level: 5,  xp: 320,  gold: 200,  streak: 0,  hp: 70 },
];

// Demo quests
const DEMO_QUESTS = [
  { title: 'Дроби и проценты',         subject: 'Математика',  type: 'quest' as const, difficulty: 'medium' as const, xp_reward: 150, gold_reward: 20, hp_damage: 10, daysUntil: 1,  status: 'active' as const },
  { title: 'Past Simple — упражнения', subject: 'Английский',  type: 'quest' as const, difficulty: 'easy' as const,   xp_reward: 100, gold_reward: 10, hp_damage: 5,  daysUntil: 2,  status: 'active' as const },
  { title: 'Площади фигур',            subject: 'Геометрия',   type: 'quest' as const, difficulty: 'hard' as const,   xp_reward: 250, gold_reward: 40, hp_damage: 15, daysUntil: 3,  status: 'active' as const },
  { title: 'Части речи',               subject: 'Русский',     type: 'quest' as const, difficulty: 'easy' as const,   xp_reward: 100, gold_reward: 10, hp_damage: 5,  daysUntil: 0,  status: 'active' as const },
  { title: 'Природные зоны',           subject: 'География',   type: 'quest' as const, difficulty: 'medium' as const, xp_reward: 150, gold_reward: 20, hp_damage: 10, daysUntil: -1, status: 'active' as const },
  { title: 'Басни Крылова',            subject: 'Литература',  type: 'quest' as const, difficulty: 'easy' as const,   xp_reward: 100, gold_reward: 15, hp_damage: 5,  daysUntil: 5,  status: 'active' as const },
];

// Activity log entries (offsets in hours from now)
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

// News items
const DEMO_NEWS = [
  { title: 'Новый сезон начался!',                body: 'Сезон "Весна 2026" стартовал. Новые боссы, артефакты и награды ждут вас!', type: 'event' as const, pinned: true,  hoursAgo: 48 },
  { title: 'Стрик-челлендж',                      body: 'Кто продержит стрик 14 дней — получит эпический артефакт! Не пропускайте ДЗ.',    type: 'info' as const,  pinned: false, hoursAgo: 24 },
  { title: 'Артём Волков победил босса!',          body: 'Артём нанёс решающий удар Дракону Алгебры. Весь класс получил бонус XP!',          type: 'reward' as const,pinned: false, hoursAgo: 8 },
  { title: 'Новые предметы в магазине',            body: 'Добавлены сезонные сундуки и косметика. Загляните в магазин!',                     type: 'info' as const,  pinned: false, hoursAgo: 72 },
];

export async function POST() {
  try {
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

    // ── 3. Create or find demo auth user ──
    let userId: string;
    const { data: listData } = await admin.auth.admin.listUsers();
    const existingAuth = listData?.users?.find(u => u.email === DEMO_EMAIL);
    if (existingAuth) {
      userId = existingAuth.id;
      await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
    } else {
      const { data: a, error: e } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
      });
      if (e || !a?.user) return NextResponse.json({ error: `Auth: ${e?.message}` }, { status: 500 });
      userId = a.user.id;
    }

    // ── 4. Upsert demo user profile ──
    await admin.from('users').upsert({
      id: userId, display_name: DEMO_NAME, role: 'student',
      school_id: schoolId, class_id: classId,
    });

    // ── 5. Upsert demo hero (ALWAYS reset to starting state) ──
    const { data: heroData, error: heroErr } = await admin.from('heroes').upsert({
      user_id: userId, name: DEMO_NAME, gender: 'male',
      level: 12, xp: 850, xp_to_next: 1200,
      hp: 78, hp_max: 100, gold: 2500,
      streak_current: 7, streak_best: 14,
      streak_last_date: new Date().toISOString().split('T')[0],
      status: 'active', artifact_slots: 6,
      gold_multiplier: 1, xp_multiplier: 1, season_id: seasonId,
    }, { onConflict: 'user_id' }).select('id').single();
    if (heroErr || !heroData) return NextResponse.json({ error: `Hero: ${heroErr?.message}` }, { status: 500 });
    const heroId = heroData.id;

    // ── 6. Hero stats (radar chart) ──
    await admin.from('hero_stats').upsert({
      hero_id: heroId,
      strength: 18, knowledge: 22, endurance: 15, luck: 12, wisdom: 20,
    }, { onConflict: 'hero_id' });

    // ── 7. Ensure classmates exist (for leaderboard) ──
    const classmateHeroIds: string[] = [];
    for (const cm of CLASSMATES) {
      const cmEmail = `demo_${cm.name.replace(/\s/g, '').toLowerCase()}@hero.academy`;

      // Find or create auth user
      let cmUserId: string;
      const existing = listData?.users?.find(u => u.email === cmEmail);
      if (existing) {
        cmUserId = existing.id;
      } else {
        const { data: a, error: e } = await admin.auth.admin.createUser({
          email: cmEmail, password: 'DemoNPC2026!', email_confirm: true,
        });
        if (e || !a?.user) continue;
        cmUserId = a.user.id;
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

    // ── 8. Clean demo-related data and reprovision ──
    // Delete old demo quests, activity, news for this class
    await admin.from('quests').delete().eq('class_id', classId);
    await admin.from('activity_log').delete().eq('hero_id', heroId);
    await admin.from('news').delete().eq('target_class_id', classId);
    await admin.from('hero_artifacts').delete().eq('hero_id', heroId);
    await admin.from('achievements_unlocked').delete().eq('hero_id', heroId);
    await admin.from('transactions').delete().eq('hero_id', heroId);

    // ── 9. Create quests with attempts ──
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

      // First 2 quests: completed by demo hero, rest: pending
      if (q.daysUntil <= 0) {
        await admin.from('quest_attempts').insert({
          quest_id: quest.id, hero_id: heroId,
          status: 'completed', correct_count: 8, mistake_count: 1,
          xp_earned: q.xp_reward, gold_earned: q.gold_reward, hp_lost: q.hp_damage,
          grade: q.daysUntil === 0 ? 5 : 4,
        });
      }
    }

    // ── 10. Provision inventory (artifacts + chests) ──
    await provisionInventory(heroId);

    // ── 11. Activity log ──
    const activityRows = DEMO_ACTIVITY.map(a => ({
      user_id: userId,
      hero_id: heroId,
      action: a.action,
      metadata: a.meta,
      xp_change: a.xp,
      hp_change: a.hp,
      gold_change: a.gold,
      created_at: new Date(now - a.hoursAgo * 3600000).toISOString(),
    }));
    await admin.from('activity_log').insert(activityRows);

    // ── 12. Transactions history ──
    const txRows = [
      { hero_id: heroId, type: 'reward' as const, item_type: 'xp', amount: 150, description: 'Квест: Уравнения', created_at: new Date(now - 2 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'gold', amount: 20, description: 'Квест: Уравнения', created_at: new Date(now - 2 * 3600000).toISOString() },
      { hero_id: heroId, type: 'purchase' as const, item_type: 'gold', amount: -50, description: 'Покупка: Малое зелье HP', created_at: new Date(now - 12 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'xp', amount: 250, description: 'Стрик 7 дней', created_at: new Date(now - 24 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'gold', amount: 50, description: 'Стрик 7 дней', created_at: new Date(now - 24 * 3600000).toISOString() },
      { hero_id: heroId, type: 'reward' as const, item_type: 'xp', amount: 300, description: 'Босс повержен: Фантом Грамматики', created_at: new Date(now - 120 * 3600000).toISOString() },
    ];
    await admin.from('transactions').insert(txRows);

    // ── 13. News ──
    const newsRows = DEMO_NEWS.map(n => ({
      title: n.title, body: n.body, type: n.type,
      target_type: 'class' as const, target_class_id: classId,
      pinned: n.pinned, created_by: userId,
      created_at: new Date(now - n.hoursAgo * 3600000).toISOString(),
    }));
    await admin.from('news').insert(newsRows);

    // ── 14. Subject bosses (for quests tab boss section) ──
    // Clean old boss data for this class/season
    const { data: oldBosses } = await admin.from('subject_bosses')
      .select('id').eq('class_id', classId).eq('season_id', seasonId);
    if (oldBosses && oldBosses.length > 0) {
      const bossIds = oldBosses.map(b => b.id);
      await admin.from('boss_damage_logs').delete().in('boss_id', bossIds);
      await admin.from('subject_bosses').delete().eq('class_id', classId).eq('season_id', seasonId);
    }

    // Create 2 subject bosses
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
        // Add damage logs from demo hero and classmates
        const dmgLogs = [
          { boss_id: boss.id, hero_id: heroId, damage_dealt: 800, action_type: 'homework', created_at: new Date(now - 8 * 3600000).toISOString() },
          { boss_id: boss.id, hero_id: heroId, damage_dealt: 400, action_type: 'lesson_mark', created_at: new Date(now - 50 * 3600000).toISOString() },
        ];
        // Classmate damage
        for (let i = 0; i < Math.min(classmateHeroIds.length, 4); i++) {
          dmgLogs.push({
            boss_id: boss.id,
            hero_id: classmateHeroIds[i],
            damage_dealt: 200 + i * 100,
            action_type: i % 2 === 0 ? 'homework' : 'lesson_mark',
            created_at: new Date(now - (10 + i * 20) * 3600000).toISOString(),
          });
        }
        await admin.from('boss_damage_logs').insert(dmgLogs);
      }
    }

    // ── 15. Achievements ──
    const { data: achievements } = await admin.from('achievements')
      .select('id, condition_type, condition_value')
      .in('condition_type', ['quests_completed', 'streak_days', 'bosses_killed', 'artifacts_collected', 'gold_total']);
    if (achievements) {
      const toUnlock = achievements.filter(a =>
        (a.condition_type === 'quests_completed' && a.condition_value <= 47) ||
        (a.condition_type === 'streak_days' && a.condition_value <= 14) ||
        (a.condition_type === 'bosses_killed' && a.condition_value <= 3) ||
        (a.condition_type === 'artifacts_collected' && a.condition_value <= 10) ||
        (a.condition_type === 'gold_total' && a.condition_value <= 3800)
      );
      if (toUnlock.length > 0) {
        await admin.from('achievements_unlocked').insert(
          toUnlock.map(a => ({ hero_id: heroId, achievement_id: a.id }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      message: 'Demo fully provisioned',
    });
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

  // Equipped (on shelf)
  add(find('Зелье опыта'),        true, 2, 3, 'drop');
  add(find('Щит стража'),         true, 1, 1, 'shop');
  add(find('Свеча Полуночника'),  true, 1, 1, 'streak_reward');

  // Backpack
  add(find('Перо мудрости'),      false, 1, 1, 'drop');
  add(find('Мешок золота'),       false, 3, 1, 'reward');
  add(find('Сфера знаний'),       false, 1, 1, 'lootbox');
  add(find('Малое зелье HP'),     false, 5, 1, 'shop');
  add(find('Большое зелье HP'),   false, 2, 1, 'shop');
  add(find('Корона героя'),       false, 1, 1, 'lootbox');
  add(find('Крест воскрешения'),  false, 1, 1, 'teacher_gift');

  // Chests — all 4 rarities
  add(findEffect('lootbox', 'common'),    false, 3, 1, 'reward');
  add(findEffect('lootbox', 'rare'),      false, 2, 1, 'reward');
  add(findEffect('lootbox', 'epic'),      false, 1, 1, 'drop');
  add(findEffect('lootbox', 'legendary'), false, 1, 1, 'teacher_gift');

  if (inv.length > 0) {
    await admin.from('hero_artifacts').insert(inv);
  }
}
