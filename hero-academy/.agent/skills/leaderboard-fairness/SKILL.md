---
name: "leaderboard-fairness"
description: "Ensure dynamic, non-frozen rankings over a season"
---

# Leaderboard Fairness

In gamification, if rank #1 is mathematically unreachable by week 3, ranks #2-#30 will give up solving optional quests.

## Risk Factors
- **Snowballing**: Rank #1 gets the best drops, uses them to get more XP, widening the gap.
- **Permanent Streaks**: Unbreakable streaks generating infinite exponential rewards.

## Analyzing Fairness
- Track the "Gini coefficient" or gap between highest and lowest XP in simulations.
- Do trailing players have "catch-up" mechanics? (e.g. passive bonuses or flat rewards that matter more at lower levels).
- Watch out for `XP_MULTIPLIER_3X` items. If they last too long, they destroy the leaderboard integrity.
