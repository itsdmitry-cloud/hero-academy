---
name: "survival-and-death-balance"
description: "Model death loops and recovery mechanics to avoid absolute churn"
---

# Survival and Death Balance

Death in Hero Academy (reaching 0 HP) means the student's avatar is inactive. While gamified consequences are fun, permanent lock-outs destroy educational motivation.

## Core Rules
1. **Never Too Safe**:
   - If students can answer blindly and never risk death, the mechanic is ignored.
   - Adjust `dmg_multiplier` until careless errors result in death within 2-3 weeks.
2. **Comeback Paths**:
   - Alpha success requires "Resurrection".
   - Validate if items like `PREVENT_DEATH_30` or `FIRE_AUTO_RESURRECT` drop frequently enough to save an active but struggling student.
   - Check if Gold is sufficient to buy an "Эликсир Жизни" (HP potion) in the shop after death.

## Simulation Test
Create a simulator where a student gets every 3rd question wrong. Check what day they hit 0 HP. Model their gold income. Can they buy a revive? If not, the death loop is too punishing.
