# Class Artifact Notifications — Design Spec

## Summary

When a student equips a team artifact or uses a class-wide potion, the entire class is notified via:
1. **Activity log entry** for every hero in the class
2. **Carousel banner with countdown timer** at the top of the hero page

## Scope

- Hero page only (not global layout)
- Team artifacts (equip-based with duration): team_xp, team_gold, team_dmg_reduce
- Class-wide consumables (instant): consumable_class_xp, consumable_class_hp, consumable_class_gold, consumable_boss_damage

## Backend Changes

### 1. New action type in `constants.ts`

Add `TEAM_ARTIFACT_ACTIVATED = 'team_artifact_activated'` to `ACTIVITY_ACTIONS`.

### 2. Activity logging in `use-artifact` API

**On team artifact equip** (when `is_equipped` is set to true for a team artifact):

After equipping the artifact, find all heroes in the same class and insert an `activity_log` entry for each:

```
action: 'team_artifact_activated'
xp_change: 0
hp_change: 0
gold_change: 0
metadata: {
  artifact: "Кольцо Всевластия",
  activator_name: "Слава",          // display_name of the user who activated
  effect: "team_xp",                 // effect type
  effect_value: 10,                  // percentage or flat value
  duration_hours: 48,                // null for instant consumables
  expires_at: "2026-04-14T12:00:00Z", // null for instant consumables
  icon: "💍"                          // artifact icon
}
```

**On class-wide consumable use** (consumable_class_xp/hp/gold/boss_damage):

Same pattern but with `duration_hours: null` and `expires_at: null`. The actual XP/gold/HP changes are already logged in separate activity entries per hero — this entry is purely informational about WHO activated WHAT.

### 3. Detection of team artifacts

Team artifacts are identified by their `effect` field starting with `team_` prefix. The equip flow in `use-artifact` or the artifacts hook must trigger the class-wide logging when a team artifact is equipped.

## Frontend Changes

### 4. ClassAuraBanner component

**Location:** New component rendered at the top of hero page.

**Data source:** `getClassAuras()` from `artifact-engine.ts` — already returns active team effects with expires_at, owner name, effect type, and value. This data is already fetched in the hero page flow.

**Behavior:**
- 0 active auras → component not rendered
- 1 active aura → static banner
- 2+ active auras → auto-rotating carousel (5-second interval), dot indicators at bottom

**Banner content per slide:**
```
[icon] [activator_name] активировал «[artifact_name]» — +[value]% [effect_description] всему классу
⏱ Осталось: [countdown]
[progress bar showing remaining time / total duration]
```

**Countdown:** Client-side `setInterval` updating every 60 seconds. Calculated from `expires_at` vs `Date.now()`.

**Progress bar:** `(expires_at - now) / (duration_hours * 3600000)` — percentage of time remaining.

**Styling:**
- Compact horizontal bar with rounded corners
- Gradient background based on artifact rarity:
  - Rare → blue gradient
  - Epic → purple gradient  
  - Legendary → gold gradient
- Text: white, semi-bold
- Subtle glow/shimmer animation

### 5. Activity log display in `use-supabase-sync.ts`

Add mapping for `team_artifact_activated`:

- **Category:** `event`
- **Display text (duration-based):** "[activator_name] активировал «[artifact]» — +[value]% [effect] классу на [duration]ч"
- **Display text (instant):** "[activator_name] использовал «[artifact]» — весь класс получил +[value] [effect]"
- **Icon:** from metadata.icon
- **Not filtered** from display (unlike lootbox_opened, shop_purchase)

## Files to modify

1. `src/lib/game/constants.ts` — add TEAM_ARTIFACT_ACTIVATED action
2. `src/app/api/game/use-artifact/route.ts` — log team_artifact_activated for all class heroes on team artifact equip and class consumable use
3. `src/app/(student)/hero/page.tsx` — add ClassAuraBanner component at top
4. `src/lib/hooks/use-supabase-sync.ts` — add team_artifact_activated mapping in activity transform
5. New file: `src/components/class-aura-banner.tsx` — the carousel banner component

## Edge cases

- **Artifact expires while page is open:** Countdown reaches 0 → banner slide auto-removes, carousel adjusts
- **Multiple auras from same student:** Each shown as separate slide
- **Student views own activation:** Same display — they see it in their own log too
- **Artifact unequipped early:** `getClassAuras()` won't return it → banner disappears on next data refresh. Activity log entry remains as historical record.
