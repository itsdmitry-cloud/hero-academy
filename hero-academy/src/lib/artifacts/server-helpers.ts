// src/lib/artifacts/server-helpers.ts
// Pure functions extracted from useArtifacts hook for server-side reuse
// and unit testing without Supabase dependencies.

export function getMaxEquipSlots(heroLevel: number): number {
  if (heroLevel >= 15) return 6;
  if (heroLevel >= 12) return 5;
  if (heroLevel >= 9) return 4;
  if (heroLevel >= 6) return 3;
  if (heroLevel >= 3) return 2;
  return 1;
}

export type ValidateEquipInput = {
  heroLevel: number;
  artifact: {
    artifact_type?: string | null;
    effect?: string | null;
    effect_value?: number | null;
    duration_hours?: number | null;
    min_level?: number | null;
  };
  currentlyEquippedExclSelf: number;
  isExpired: boolean;
};

export type ValidateEquipResult =
  | { ok: true; expiresAt: string | null }
  | { ok: false; code: 'level_too_low' | 'slots_full' | 'expired' | 'not_equippable'; message: string };

const INSTANT_EFFECT_PREFIXES = ['hp_restore', 'xp_instant', 'gold_instant'];
const INSTANT_EFFECT_EXACT = new Set(['extra_gold', 'level_up']);

function isInstantConsumableEffect(effect: string): boolean {
  if (INSTANT_EFFECT_EXACT.has(effect)) return true;
  return INSTANT_EFFECT_PREFIXES.some((p) => effect === p || effect.startsWith(`${p}_`));
}

export function validateEquip(input: ValidateEquipInput): ValidateEquipResult {
  const { heroLevel, artifact, currentlyEquippedExclSelf, isExpired } = input;
  const effect = artifact.effect ?? '';

  if (isExpired) {
    return { ok: false, code: 'expired', message: 'Срок действия артефакта истёк.' };
  }

  if (artifact.artifact_type === 'consumable' && isInstantConsumableEffect(effect)) {
    return { ok: false, code: 'not_equippable', message: 'Мгновенные зелья нельзя экипировать. Используйте «Применить».' };
  }

  const minLevel = artifact.min_level ?? 1;
  if (heroLevel < minLevel) {
    return { ok: false, code: 'level_too_low', message: `Требуется уровень ${minLevel}. Ваш: ${heroLevel}` };
  }

  const maxSlots = getMaxEquipSlots(heroLevel);
  if (currentlyEquippedExclSelf >= maxSlots) {
    return { ok: false, code: 'slots_full', message: `Все слоты заняты (${maxSlots}). Снимите другой артефакт.` };
  }

  const durationH = artifact.duration_hours ?? 0;
  const expiresAt = durationH > 0 ? new Date(Date.now() + durationH * 3600_000).toISOString() : null;
  return { ok: true, expiresAt };
}

export function calculateSellRefund(dropRate: number | null | undefined): number {
  const rate = dropRate ?? 10;
  return Math.floor(rate * 5);
}

export type ConsumeEffectKind = 'instant' | 'complex' | 'not_consumable';

export function classifyConsumeEffect(effect: string | null | undefined): ConsumeEffectKind {
  const e = effect ?? '';
  if (!e) return 'not_consumable';
  if (isInstantConsumableEffect(e)) return 'instant';
  if (e.startsWith('consumable_') || e === 'gold_bonus') return 'complex';
  return 'not_consumable';
}
