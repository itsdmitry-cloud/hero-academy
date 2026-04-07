---
name: "boss-progression"
description: "Evaluate class-wide damage output against Season Boss HP scaling"
---

# Boss Progression

The Season Boss is a collective target (`season_boss_class_hp`). 

## Scaling Factors
Boss HP is calculated based on:
1. `CLASS_SIZE`
2. `SEASON_DURATION`
3. `boss_hp_multiplier` (Configured by admin)
4. Base Boss Health.

## Balancing Goal
- **Win Condition**: The class defeats the boss during the final week of the quarter.
- **Fail Condition 1**: The boss dies in Month 1. (Too weak, trivialized).
- **Fail Condition 2**: The boss survives with 50% HP at the end of the quarter. (Too fat, demoralizing).

## Actionable Strategy
Always execute `scripts/test-boss-hp.ts` after altering:
- The XP/Damage output of basic tasks.
- Artifact drop rates for damage boosting items (`FIRE_COMMAND_DAMAGE`, etc.).
Never trust raw math; run the simulated 90-day loop!
