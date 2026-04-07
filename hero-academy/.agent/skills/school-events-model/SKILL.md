---
name: "school-events-model"
description: "Treat real school activities as reliable gameplay events in simulations"
---

# School Events Model

Simulations must map exact school cadences to game events. 

## The Core Cadence
1. **Homework (`quest`)**: 
   - Frequency: Daily (2-4 times a week per subject).
   - Difficulty: 1 - 2.
   - Purpose: Streak maintenance, slow and steady XP/Gold output.
2. **Classwork (`dungeon`)**:
   - Frequency: Weekly (In-class participation).
   - Difficulty: 3.
   - Purpose: Artifact drop spikes.
3. **Tests/Exams (`boss`)**:
   - Frequency: Monthly / End of Quarter.
   - Difficulty: 4 - 5.
   - Purpose: Massive HP risk, huge XP bursts, legendary artifact drops.

## Simulation Rules
When modeling a 90-day Quarter (Season):
- Do not assume 90 consecutive quests.
- Assume 40-50 total academic days.
- Spread 5-7 Dungeons and 1-2 Boss battles evenly.
- The balance must ensure that the sum of these rewards provides roughly the XP needed to hit the "Max Level" of the quarter.
