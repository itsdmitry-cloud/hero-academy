import { describe, it, expect } from 'vitest';
import {
  getMaxEquipSlots,
  validateEquip,
  calculateSellRefund,
  classifyConsumeEffect,
} from '../server-helpers';

describe('getMaxEquipSlots', () => {
  it('returns 1 for level 1-2', () => {
    expect(getMaxEquipSlots(1)).toBe(1);
    expect(getMaxEquipSlots(2)).toBe(1);
  });
  it('opens slots every 3 levels, caps at 6', () => {
    expect(getMaxEquipSlots(3)).toBe(2);
    expect(getMaxEquipSlots(6)).toBe(3);
    expect(getMaxEquipSlots(9)).toBe(4);
    expect(getMaxEquipSlots(12)).toBe(5);
    expect(getMaxEquipSlots(15)).toBe(6);
    expect(getMaxEquipSlots(99)).toBe(6);
  });
});

describe('validateEquip', () => {
  const baseArt = {
    artifact_type: 'passive',
    effect: 'xp_boost',
    effect_value: 10,
    duration_hours: 0,
    min_level: 1,
  };

  it('rejects when hero level below min_level', () => {
    const r = validateEquip({
      heroLevel: 2,
      artifact: { ...baseArt, min_level: 5 },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('level_too_low');
  });

  it('rejects when slots full', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: baseArt,
      currentlyEquippedExclSelf: 2,
      isExpired: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('slots_full');
  });

  it('rejects expired artifact (cannot re-equip)', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: baseArt,
      currentlyEquippedExclSelf: 0,
      isExpired: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('expired');
  });

  it('rejects instant consumable (must be drunk, not equipped)', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: { ...baseArt, artifact_type: 'consumable', effect: 'hp_restore' },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_equippable');
  });

  it('rejects complex consumable (consumable_*, gold_bonus) — also must be drunk', () => {
    const r1 = validateEquip({
      heroLevel: 5,
      artifact: { ...baseArt, artifact_type: 'consumable', effect: 'consumable_class_xp' },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('not_equippable');

    const r2 = validateEquip({
      heroLevel: 5,
      artifact: { ...baseArt, artifact_type: 'consumable', effect: 'gold_bonus' },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('not_equippable');
  });

  it('accepts valid equip', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: baseArt,
      currentlyEquippedExclSelf: 1,
      isExpired: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expiresAt).toBeNull();
  });

  it('returns expiresAt when artifact has duration', () => {
    const before = Date.now();
    const r = validateEquip({
      heroLevel: 5,
      artifact: { ...baseArt, duration_hours: 24 },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.expiresAt) {
      const ms = new Date(r.expiresAt).getTime();
      expect(ms).toBeGreaterThanOrEqual(before + 24 * 3600_000 - 1000);
      expect(ms).toBeLessThanOrEqual(before + 24 * 3600_000 + 1000);
    }
  });
});

describe('calculateSellRefund', () => {
  it('floors drop_rate * 5', () => {
    expect(calculateSellRefund(10)).toBe(50);
    expect(calculateSellRefund(2.5)).toBe(12);
    expect(calculateSellRefund(0)).toBe(0);
  });
  it('falls back to 10 when drop_rate undefined', () => {
    expect(calculateSellRefund(null)).toBe(50);
    expect(calculateSellRefund(undefined)).toBe(50);
  });
});

describe('classifyConsumeEffect', () => {
  it('classifies hp_restore as instant', () => {
    expect(classifyConsumeEffect('hp_restore')).toBe('instant');
    expect(classifyConsumeEffect('hp_restore_30')).toBe('instant');
  });
  it('classifies xp_instant variants as instant', () => {
    expect(classifyConsumeEffect('xp_instant')).toBe('instant');
    expect(classifyConsumeEffect('xp_instant_50')).toBe('instant');
  });
  it('classifies extra_gold and gold_instant as instant', () => {
    expect(classifyConsumeEffect('extra_gold')).toBe('instant');
    expect(classifyConsumeEffect('gold_instant')).toBe('instant');
  });
  it('classifies level_up as instant', () => {
    expect(classifyConsumeEffect('level_up')).toBe('instant');
  });
  it('classifies consumable_* and gold_bonus as complex', () => {
    expect(classifyConsumeEffect('consumable_class_xp')).toBe('complex');
    expect(classifyConsumeEffect('gold_bonus')).toBe('complex');
  });
  it('classifies passive effects as not_consumable', () => {
    expect(classifyConsumeEffect('xp_boost')).toBe('not_consumable');
    expect(classifyConsumeEffect('damage_shield')).toBe('not_consumable');
    expect(classifyConsumeEffect('')).toBe('not_consumable');
  });
});
