---
name: "alpha-success-metrics"
description: "Concrete conditions defining a successful Alpha test"
---

# Alpha Success Metrics

When simulating or reviewing analytics, the Alpha is considered a "Success" if it meets the following KPI conditions across a 30-to-90 day timeline.

## Quantitative Metrics
1. **Survival Rate**: > 75% of active students never touch 0 HP.
2. **Shop Rotation**: At least 50% of earned Gold is spent. If players hoard gold, the shop is useless or too expensive.
3. **Artifact Usage**: > 80% of equipped artifacts are actually utilized in quests. If players let `.expires_at` trigger without using them, the effects are too weak or confusing.
4. **Leaderboard Velocity**: Rank 1 changes hands at least 3 times during a Season.

## Reporting
Agents evaluating Alpha data via DB or Scripts must output a pass/fail matrix against these 4 metrics. If any metric fails in simulation, *re-balance the tunables* (`economy_config`, `artifact-registry`) before committing code.
