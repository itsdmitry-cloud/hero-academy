import { describe, it, expect } from 'vitest';
import { calculateQuestResult, HeroState, QuestResult, PlayerArtifact, ARTIFACT_CATALOG } from '@/lib/utils/artifacts';

describe('Artifacts Engine - calculateQuestResult', () => {

  const baseHero: HeroState = {
    hp: 100,
    xp: 500,
    gold: 100,
    level: 5,
    streak: 10,
    activeArtifacts: [],
  };

  const baseQuest: QuestResult = {
    baseXp: 100,
    baseGold: 50,
    baseDamage: 0,
  };

  it('1. No artifacts: returns base rewards', () => {
    const result = calculateQuestResult(baseHero, baseQuest, []);
    expect(result.finalXp).toBe(100);
    expect(result.finalGold).toBe(50);
    expect(result.finalDamage).toBe(0);
    expect(result.preventedDeath).toBe(false);
  });

  it('2. Stack XP multipliers', () => {
    // com_pen: XP_BOOST_10 (+10% XP)
    // rar_pen: XP_BOOST_20 (+20% XP)
    const eq: PlayerArtifact[] = [
      { id: '1', defId: 'com_pen', is_equipped: true },
      { id: '2', defId: 'rar_pen', is_equipped: true },
    ];
    
    // Simulate both equipped AND active in heroState
    const hero = { ...baseHero, activeArtifacts: ['1', '2'] };
    // Multiplier = 1.0 + 0.10 + 0.20 = 1.3
    // 100 * 1.3 = 130
    
    const result = calculateQuestResult(hero, baseQuest, eq);
    expect(result.finalXp).toBe(130);
  });

  it('3. Prevent fatal damage (PREVENT_DEATH_50) and leave 50 HP', () => {
    const eq: PlayerArtifact[] = [
      { id: '1', defId: 'leg_cross', is_equipped: true }, // PREVENT_DEATH_50
    ];
    
    const hero = { ...baseHero, hp: 40, activeArtifacts: ['1'] };
    const quest = { ...baseQuest, baseDamage: 100 }; // 40 - 100 = -60 (lethal)
    
    const result = calculateQuestResult(hero, quest, eq);
    
    expect(result.preventedDeath).toBe(true);
    // Original hp - result.finalDamage should equal 50.
    // 40 - finalDamage = 50 => finalDamage = -10 (which means it "heals" to 50 via damage adjustment logic in engine)
    expect(hero.hp - result.finalDamage).toBe(50);
    expect(result.artifactsUsed).toContain('1');
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('4. Block critical damage (BLOCK_CRITICAL_DMG)', () => {
    const eq: PlayerArtifact[] = [
      { id: '1', defId: 'epi_shield', is_equipped: true }, // BLOCK_CRITICAL_DMG
    ];
    
    const hero = { ...baseHero, activeArtifacts: ['1'] };
    const quest = { ...baseQuest, baseDamage: 50, isCriticalMistake: true }; 
    
    const result = calculateQuestResult(hero, quest, eq);
    
    expect(result.finalDamage).toBe(0); // Fully absorbed
    expect(result.artifactsUsed).toContain('1');
  });

  it('5. Streak protection (PROTECT_STREAK)', () => {
    // Only "PROTECT_STREAK" works slightly differently but let's test if FIRE_STREAK_SHIELD flags protectedStreak
    const eq: PlayerArtifact[] = [
      { id: '1', defId: 'fire_dragon_scale', is_equipped: true }, // FIRE_STREAK_SHIELD
    ];
    
    const hero = { ...baseHero, activeArtifacts: ['1'] };
    const result = calculateQuestResult(hero, baseQuest, eq);
    
    expect(result.protectedStreak).toBe(true);
    expect(result.artifactsUsed).toContain('1');
  });

  it('6. Absolute multipliers applied correctly (GOLD_MULTIPLIER_3X)', () => {
    const eq: PlayerArtifact[] = [
      { id: '1', defId: 'leg_dragon', is_equipped: true }, // GOLD_MULTIPLIER_3X
    ];
    
    const hero = { ...baseHero, activeArtifacts: ['1'] };
    const result = calculateQuestResult(hero, baseQuest, eq);
    
    // baseGold = 50 * 3.0 = 150
    expect(result.finalGold).toBe(150);
  });
});
