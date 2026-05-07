// src/lib/hero/__tests__/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { mapHero, mapStats, mapActivity, mapInventory } from '../mappers';
import type { HeroRow, ActivityLogRow, HeroArtifactRow } from '../types';

describe('hero mappers', () => {
  describe('mapHero', () => {
    const baseRow: HeroRow = {
      id: 'hero-1', user_id: 'u-1', name: 'Алиса', gender: 'female',
      level: 5, xp: 1200, xp_to_next: 1500, hp: 80, hp_max: 100, gold: 250,
      streak_current: 3, streak_best: 7, season_xp: 800,
    };

    it('maps full row to ExtendedHeroState', () => {
      const result = mapHero(baseRow, null);
      expect(result.heroId).toBe('hero-1');
      expect(result.name).toBe('Алиса');
      expect(result.gender).toBe('female');
      expect(result.level).toBe(5);
      expect(result.xp).toBe(1200);
      expect(result.xp_to_next).toBe(1500);
      expect(result.hp).toBe(80);
      expect(result.hp_max).toBe(100);
      expect(result.gold).toBe(250);
      expect(result.streak).toBe(3);
      expect(result.streak_best).toBe(7);
      expect(result.season_xp).toBe(800);
    });

    it('treats null streak_current/streak_best/season_xp as 0', () => {
      const result = mapHero({ ...baseRow, streak_current: null, streak_best: null, season_xp: null }, null);
      expect(result.streak).toBe(0);
      expect(result.streak_best).toBe(0);
      expect(result.season_xp).toBe(0);
    });

    it('preserves activeArtifacts as empty array (filled by mapInventory separately)', () => {
      const result = mapHero(baseRow, null);
      expect(result.activeArtifacts).toEqual([]);
    });

    it('preserves avatar default emoji', () => {
      const male = mapHero({ ...baseRow, gender: 'male' }, null);
      const female = mapHero({ ...baseRow, gender: 'female' }, null);
      expect(typeof male.avatar).toBe('string');
      expect(typeof female.avatar).toBe('string');
    });
  });

  describe('mapStats', () => {
    it('returns null when stats is null', () => {
      expect(mapStats(null)).toBeNull();
    });

    it('maps stats row to store shape', () => {
      expect(mapStats({ strength: 1, knowledge: 2, endurance: 3, luck: 4, wisdom: 5 }))
        .toEqual({ strength: 1, knowledge: 2, endurance: 3, luck: 4, wisdom: 5 });
    });
  });

  describe('mapActivity', () => {
    const base: Omit<ActivityLogRow, 'action' | 'metadata'> = {
      id: 'log-1', user_id: 'u-1', hero_id: 'h-1',
      xp_change: 0, gold_change: 0, hp_change: 0,
      created_at: '2026-05-07T10:00:00Z',
    };

    it('returns empty array for empty input', () => {
      expect(mapActivity([])).toEqual([]);
    });

    it('skips ignored actions (lootbox_opened, shop_purchase, etc.)', () => {
      const rows: ActivityLogRow[] = [
        { ...base, action: 'lootbox_opened', metadata: {} },
        { ...base, action: 'shop_purchase', metadata: {} },
        { ...base, action: 'teacher_gold_grant', metadata: {} },
        { ...base, action: 'bp_reward_claimed', metadata: {} },
        { ...base, action: 'seasonal_lootbox_opened', metadata: {} },
      ];
      expect(mapActivity(rows)).toEqual([]);
    });

    it('maps quest_completed with quest name from metadata', () => {
      const result = mapActivity([
        { ...base, action: 'quest_completed', metadata: { quest: 'Параграф 5' }, xp_change: 100 },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].quest).toBe('Параграф 5');
      expect(result[0].result).toBe('✅ Успех');
      expect(result[0].xp).toBe('+100');
      expect(result[0].category).toBe('quest');
    });

    it('maps boss_kill_reward with damage % and MVP flag', () => {
      const result = mapActivity([
        {
          ...base,
          action: 'boss_kill_reward',
          metadata: { reason: '15% урона Боссу (Алгебра) — MVP' },
          xp_change: 500,
        },
      ]);
      expect(result[0].quest).toContain('Алгебра');
      expect(result[0].result).toContain('15%');
      expect(result[0].result).toContain('👑');
      expect(result[0].category).toBe('boss');
    });

    it('formats xp/gold changes with sign', () => {
      const result = mapActivity([
        { ...base, action: 'grant_xp', xp_change: 50, gold_change: 0, metadata: { reason: 'Бонус' } },
        { ...base, action: 'damage', xp_change: 0, hp_change: -10, metadata: { reason: 'Ошибка' } },
      ]);
      expect(result[0].xp).toBe('+50');
      expect(result[1].xp).toBe('-');
    });

    it('exposes raw fields for ActionBreakdown', () => {
      const result = mapActivity([
        { ...base, action: 'quest_completed', xp_change: 50, gold_change: 10, hp_change: -5, metadata: { quest: 'X' } },
      ]);
      expect(result[0].xpChangeRaw).toBe(50);
      expect(result[0].goldChangeRaw).toBe(10);
      expect(result[0].hpChangeRaw).toBe(-5);
      expect(result[0].action).toBe('quest_completed');
    });
  });

  describe('mapInventory', () => {
    const baseArt = {
      id: 'a1', name: 'Зелье', description: '', rarity: 'common' as const,
      icon: '⚗️', effect: 'hp_restore', effect_value: 30,
      duration_hours: 0, drop_rate: 0.1, stackable: false,
      max_charges: 1, is_shopable: true,
    };

    it('returns empty for no rows', () => {
      expect(mapInventory([])).toEqual([]);
    });

    it('drops expired artifacts (expires_at < now)', () => {
      const rows: HeroArtifactRow[] = [
        {
          id: 'ha1', artifact_id: 'a1', hero_id: 'h1', slot_index: null,
          is_equipped: false, quantity: 1, charges_remaining: 1,
          acquired_at: '2026-01-01', expires_at: '2020-01-01T00:00:00Z',
          source: 'shop', artifact: baseArt,
        },
      ];
      expect(mapInventory(rows)).toEqual([]);
    });

    it('keeps unexpired and unconstrained artifacts', () => {
      const rows: HeroArtifactRow[] = [
        {
          id: 'ha1', artifact_id: 'a1', hero_id: 'h1', slot_index: 0,
          is_equipped: true, quantity: 1, charges_remaining: 3,
          acquired_at: '2026-05-01', expires_at: null,
          source: 'shop', artifact: baseArt,
        },
      ];
      const result = mapInventory(rows);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ha1');
      expect(result[0].defId).toBe('a1');
      expect(result[0].is_equipped).toBe(true);
      expect(result[0].charges_left).toBe(3);
    });
  });
});
