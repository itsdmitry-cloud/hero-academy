---
name: "artifact-and-consumables-balance"
description: "Guidelines for verifying weapon and item impacts on the ecosystem"
---

# Artifact & Consumables Balance

Artifacts live in `artifact-registry.ts`. They drastically alter gameplay.

## Balance Checks
1. **Dominant Meta (OP items)**:
   - Does one artifact (e.g. `BLOCK_ALL_MISTAKES` or `XP_GOLD_MASSIVE`) break the game?
   - Test item stacking. 
   - If an item dominates, nerf its `drop_rate` or limit its `max_charges`.
2. **Class-Wide Consumables**:
   - Items like `FIRE_CLASS_XP_100` impact *everyone*. 
   - Ensure that if a class coordinates and pops 30 of these at once, they don't instantly max out their levels.
3. **Useless Items**:
   - Check if certain common drops are ignored. If items provide +1 Gold while quests give 100, the artifact is frustrating padding.

## Simulation Action
Use pure-functions in Vitest to simulate: `Hero + Base Quest + [Artifact Array]`. Assert the final payload is mathematically sound.
