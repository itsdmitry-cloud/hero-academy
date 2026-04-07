> ⚠️ DEPRECATED: Проект мигрирован на Claude Code (апрель 2026). Актуальная конфигурация: `CLAUDE.md`. Этот файл сохранён для истории.

# Hero Academy: Balance & Simulation Workspace

Welcome to the **Hero Academy** repository. This is not just a straightforward Next.js web application—it is a **simulation-first balance-testing environment**.
Our goal is to build, validate, and simulate RPG gamification before testing on real children (the Alpha).

## 🎯 Primary Goal
Turn educational activities into balanced, fair, and engaging RPG mechanics, while strictly maintaining school terminology in conversations.
The core loop: **Homework = Quest it, Tests = Boss Battle, Mistakes = Lose HP, Success = XP & Gold.**

## 🗣️ Terminology Rules
Always use proper school terminology when communicating with the user, even if the backend uses RPG terms:
- Use **Домашняя работа / Домашка** (not "quest").
- Use **Самостоятельная / Проверочная** (not "dungeon").
- Use **Контрольная / Диктант** (not "boss" unless specifically discussing the `season_boss` mechanic). 
Do NOT break immersion by using `questType` internal enum names in chat.

## 🕹️ Balancing Priorities
1. **Avoid Boredom**: Gamification without risk or anticipation is just another UI. Artifacts need to feel powerful.
2. **Avoid Hopelessness**: The bottom 20% of students must have recovery mechanisms (comeback potential). 0 HP should be a threat, but not a permanent quit-condition.
3. **Plausible Boss Victories**: The class boss must be defeated organically near the end of the quarter.
4. **Dynamic Leaderboards**: No single student should permanently lock rank #1 on Day 3.

## 🛠️ Simulation Philosophy
- **Never guess, simulate.** We have an `artifact-engine.ts` and `constants.ts`. Use them in isolated Node scripts (`scripts/test-*.ts`).
- Test multiple seeds.
- If proposing systemic changes, **first study the existing code**. Do not override the Supabase DB structure without excellent reason.
- Prefer configuration over hardcoding! Adjust values in `economy_config` or `artifact-registry.ts` rather than hardcoding modifiers in game functions.

## ⚠️ Known Gaps To Investigate
- *Parent UI interactions*: How do parents' interventions (potentially refilling HP) affect the economy?
- *Lootbox pity-timers*: Should drop rates have bad-luck mitigation?
- *Guild/School inter-class tournaments*: Mechanics exist on the roadmap but lack balance numbers yet.

## 🚀 Working Workflow
When asked to evaluate or build a mechanic:
1. Review `.agent/skills/` for the relevant philosophy.
2. Analyze `docs/systems/` if applicable, AND do a `grep_search` for related code.
3. Analyze the `artifact-registry.ts` and `constants.ts`.
4. Create/update a vitest test or simulation script in `scripts/`.
5. Present outputs based on Student Archetypes.

## 💾 The /save Protocol
If the user types the command `/save` in the chat, it means a new mechanic or architectural fix has been successfully implemented and MUST be permanently preserved.
**When you see `/save`, you MUST PRECISELY follow this checklist BEFORE writing to files:**
1. Stop generating code. Analyze the chat history to understand the specific mechanic/rule we just perfected.
2. Conduct a `grep_search` across the codebase to identify what existing systems this new rule is adjacent to, and what it might potentially conflict with.
3. Present an exact summary to the user:
   - "What logic I will save:"
   - "Where I will save it:" (e.g., `docs/systems/01_artifacts.md`)
   - "Potential conflicts / Adjacent logic:" (based on your search)
4. Ask the user for confirmation.
5. Once the user replies "Yes", write the absolute rule to the chosen `docs/systems/` file and confirm it is saved. Never rely solely on AI guessing, always check the `docs/systems/` folder before mutating core architecture files.

## ⚠️ Important Architectural Rules
- Avoid `ON DELETE CASCADE` disasters: Never use `.delete()` to wipe and re-seed tables (like `artifacts`) if they have cascade constraints to user data (like `hero_artifacts`). Always use `.upsert()`.
- Pre-flight checks: Always grep before generating large refactors.
