---
name: "simulation-core"
description: "Core principles and conventions for writing simulations in Hero Academy"
---

# Simulation Core

Hero Academy is a gamified educational platform, but this repository serves as a **balance-testing workspace**. Before pushing changes to real students, the agent must run deterministic simulations.

## 1. Simulation Philosophy
Do not rely exclusively on theoretical math. You must **simulate the behavior** using actual game logic components (e.g., `constants.ts: rollArtifactDrop`, `artifact-engine.ts`). 
Simulations should run across different horizons:
- **Day**: Single quest/homework resolution.
- **Week**: Weekly streak triggers, minor boss events.
- **Month/Quarter**: Full season lifecycle, HP depletion, final Boss survival.

## 2. Technical Implementation
- **Location**: Store all simulation scripts in `scripts/test-*.ts` (e.g., `scripts/test-boss-hp.ts`, `scripts/test-drop-rates.ts`).
- **Execution**: Run scripts via `npx tsx scripts/your-script.ts`.
- **Determinism**: Unless specifically checking pure randomness, use seeded random numbers if comparing multiple states.
- **Mocking**: Avoid hitting the actual Supabase database during 10,000x loops. Use `allDbRows()` from `artifact-registry.ts` to mock the DB state.

## 3. Output Expectations
Simulators MUST output structured telemetry:
- Averages alone are misleading. Always print **outliers** (Best performer vs Worst performer).
- Include metrics on drop distributions, XP inflation, and Boss HP pace.
