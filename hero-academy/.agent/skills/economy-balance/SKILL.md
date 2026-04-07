---
name: "economy-balance"
description: "Guidelines to validate XP, Gold, inflation, and scarcity"
---

# Economy Balance

The game uses modifiers from `economy_config` to adjust the economy dynamically.

## Principles to Validate
1. **XP Inflation**: 
   - Ensure the "Tryhard" player does not reach Level 100 within week 2 of the season. 
   - Verify `xp_multiplier` constraints.
2. **Gold Scarcity**: 
   - Gold should be scarce. A player shouldn't be able to buy an infinite amount of HP potions (`HEAL_30`).
   - If average gold income exceeds potion cost by 500%, the death mechanic becomes trivial.
3. **Runaway Leader Advantage**:
   - The rich must not get permanently richer. Limit passive "Gold Boost" artifacts.
   - Validate that the distance between rank 1 and 10 does not become mathematically impossible to close after month 1.

## Debugging Workflow
Whenever adding a new reward multiplier, simulate a 90-day run. Check the final Gold stash of all Archetypes. If the Casual has 0 and the Tryhard has 50,000, the economy is broken.
