// src/lib/hero/__tests__/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { mapHero } from '../mappers';
import type { HeroRow } from '../types';

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

  it.todo('mapActivity');
  it.todo('mapInventory');
});
