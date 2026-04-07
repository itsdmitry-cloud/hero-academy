---
name: "engagement-retention"
description: "Model student boredom, frustration, and reward anticipation"
---

# Engagement & Retention

A mechanically balanced game can still be boring.

## Factors to Simulate/Analyze
1. **Novelty Decay**: 
   - If students only ever get "Common Potions", they stop caring about drops. Ensure `rollArtifactDrop` yields Epic/Legendary items just often enough to maintain excitement (Variable Ratio Schedule of Reinforcement).
2. **Frustration**:
   - Consecutive failures without mitigation lead to churn. 
3. **Burnout**:
   - Avoid forcing 10 quests a day.

## How Agents Should Reason
When adding a new feature, ask: "Does this mechanic provide anticipation?" 
Lootboxes and random stat rolls usually provide more engagement than a flat "+10 XP". Ensure the UI and logic accommodate 'surprises'.
