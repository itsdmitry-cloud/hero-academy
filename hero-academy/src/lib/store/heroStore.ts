import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ARTIFACT_CATALOG,
  calculateQuestResult,
  HeroState as EngineHeroState,
  PlayerArtifact,
  QuestResult
} from '../utils/artifacts';
import { cumulativeXpForLevel } from '../game/math';
import { useToastStore } from './toastStore';

export interface ExtendedHeroState extends EngineHeroState {
  heroId: string;
  name: string;
  avatar: string;
  gender: 'male' | 'female';
  xp_to_next: number;
  hp_max: number;
  streak_best: number;
  season_xp: number;
}

export interface ActivityEntry {
  id: string;
  date: string;
  quest: string;
  result: string;
  xp: string;
  gold: string;
  messages?: string[];
}

interface HeroStore {
  hero: ExtendedHeroState;
  inventory: PlayerArtifact[]; // All owned artifacts
  activity: ActivityEntry[];
  stats: { strength: number; knowledge: number; endurance: number; luck: number; wisdom: number };
  synced: boolean; // true after first Supabase load — prevents flash of mock data
  
  // Actions
  equipArtifact: (artifactId: string, slotIndex?: number) => void;
  unequipArtifact: (artifactId: string) => void;
  completeQuest: (questName: string, baseResult: QuestResult) => void;
  addArtifact: (defId: string) => void;
  usePotion: (artifactId: string) => void;
  resetProgress: () => void;
  markSynced: () => void;
}

// Initial state — name is blank so no flash of mock data before Supabase sync
const initialHero: ExtendedHeroState = {
  heroId: '',
  name: '',
  avatar: '🧙‍♂️',
  gender: 'male',
  level: 1,
  xp: 0,
  xp_to_next: cumulativeXpForLevel(2), // overwritten on Supabase hero load
  hp: 100,
  hp_max: 100,
  gold: 0,
  streak: 0,
  streak_best: 0,
  season_xp: 0,
  activeArtifacts: [],
};

const initialInventory: PlayerArtifact[] = [];
// All artifacts come from Supabase DB now — no mock data

const initialActivity: ActivityEntry[] = [
  { id: '1', date: 'Сегодня', quest: 'Вход в Академию', result: '✅ Начало', xp: '+0', gold: '+0' }
];

// Legacy localStorage check removed — all data comes from Supabase

export const useHeroStore = create<HeroStore>()(
  persist(
    (set, get) => ({
      hero: initialHero,
      inventory: initialInventory,
      activity: initialActivity,
      stats: { strength: 72, knowledge: 85, endurance: 60, luck: 45, wisdom: 78 },
      synced: false,

      markSynced: () => set({ synced: true }),

      equipArtifact: (artifactId) => {
        set((state) => {
          const item = state.inventory.find(i => i.id === artifactId);
          if (!item) return state;
          
          const def = ARTIFACT_CATALOG[item.defId];
          if (state.hero.level < def.req_level) {
            alert(`Нужен ${def.req_level} уровень!`);
            return state;
          }

          if (item.is_equipped) return state; // Already equipped

          // alpha-test май 2026 — каждые 3 уровня, cap 6 (синхрон с use-artifacts.ts:getMaxSlots)
          const lvl = state.hero.level;
          const maxSlots = lvl >= 15 ? 6 : lvl >= 12 ? 5 : lvl >= 9 ? 4 : lvl >= 6 ? 3 : lvl >= 3 ? 2 : 1;
          const newActive = [...state.hero.activeArtifacts];

          if (newActive.length >= maxSlots) {
            // Remove the oldest one to make room
            const removedId = newActive.shift();
            const inv = state.inventory.map(i => i.id === removedId ? { ...i, is_equipped: false } : i);
            state.inventory = inv;
          }

          newActive.push(artifactId);
          
          return {
            hero: { ...state.hero, activeArtifacts: newActive },
            inventory: state.inventory.map(i => i.id === artifactId ? { ...i, is_equipped: true } : i)
          };
        });
      },

      unequipArtifact: (artifactId) => {
        set((state) => ({
          hero: { ...state.hero, activeArtifacts: state.hero.activeArtifacts.filter(id => id !== artifactId) },
          inventory: state.inventory.map(i => i.id === artifactId ? { ...i, is_equipped: false } : i)
        }));
      },

      usePotion: (artifactId) => {
        const state = get();
        const item = state.inventory.find(i => i.id === artifactId);
        if (!item) return;
        const def = ARTIFACT_CATALOG[item.defId];
        if (!def) return;

        const addToast = useToastStore.getState().addToast;
        const heroUpdate: Partial<ExtendedHeroState> = {};

        const code = def.effect_code;
        if (code === 'HEAL_30') {
          heroUpdate.hp = Math.min(state.hero.hp + 30, state.hero.hp_max);
          addToast({ type: 'heal', title: '+30 HP', message: `${def.name} восстановил здоровье!`, icon: '❤️', duration: 3000 });
        } else if (code === 'HEAL_60') {
          heroUpdate.hp = Math.min(state.hero.hp + 60, state.hero.hp_max);
          addToast({ type: 'heal', title: '+60 HP', message: `${def.name} восстановил здоровье!`, icon: '❤️', duration: 3000 });
        } else if (code === 'HEAL_100') {
          heroUpdate.hp = Math.min(state.hero.hp + 100, state.hero.hp_max);
          addToast({ type: 'heal', title: '+100 HP', message: `${def.name} полностью восстановил здоровье!`, icon: '💚', duration: 3000 });
        } else if (code === 'FLAT_XP_100') {
          heroUpdate.xp = state.hero.xp + 100;
          addToast({ type: 'xp', title: '+100 XP', message: `${def.name} дал мгновенный опыт!`, icon: '⭐', duration: 3000 });
        } else if (code === 'FLAT_GOLD_5') {
          heroUpdate.gold = state.hero.gold + 50;
          addToast({ type: 'gold', title: '+50 Gold', message: `${def.name} принёс золото!`, icon: '💰', duration: 3000 });
        } else if (code === 'FORCE_LEVEL_UP') {
          heroUpdate.level = state.hero.level + 1;
          heroUpdate.xp = 0;
          addToast({ type: 'levelup', title: `Уровень ${state.hero.level + 1}!`, message: `${def.name} мгновенно поднял уровень!`, icon: '🌟', duration: 5000 });
        } else if (code === 'PROTECT_STREAK') {
          addToast({ type: 'streak', title: 'Стрик защищён!', message: `${def.name} защитит стрик на 1 день`, icon: '🔥', duration: 3000 });
        } else if (code === 'SKIP_HOMEWORK') {
          addToast({ type: 'artifact', title: 'Пропуск ДЗ!', message: `${def.name} — одно ДЗ можно пропустить`, icon: '📜', duration: 3000 });
        } else {
          addToast({ type: 'artifact', title: def.name, message: 'Эффект применён!', icon: '✨', duration: 3000 });
        }

        // Remove the consumed item
        set({
          hero: { ...state.hero, ...heroUpdate },
          inventory: state.inventory.filter(i => i.id !== artifactId),
        });
      },

      addArtifact: (defId) => {
        set((state) => {
          const def = ARTIFACT_CATALOG[defId];
          if (!def) return state;
          const newItem: PlayerArtifact = {
            id: `art_${Date.now()}`,
            defId,
            is_equipped: false,
            ...(def.max_charges && { charges_left: def.max_charges }),
            ...(def.duration_hours && { expires_at: new Date(Date.now() + def.duration_hours * 3600000) })
          };
          return { inventory: [...state.inventory, newItem] };
        });
      },

      completeQuest: (questName, baseResult) => {
        set((state) => {
          // 1. Calculate applying the Engine Logic
          const result = calculateQuestResult(state.hero, baseResult, state.inventory);

          // 2. Update Hero stats
          let newHp = state.hero.hp - result.finalDamage;
          if (newHp < 0) newHp = 0; // Prevent negative HP

          const newXp = state.hero.xp + result.finalXp;
          let newLevel = state.hero.level;
          let newXpNext = state.hero.xp_to_next;

          // Cumulative XP: just add, never subtract
          while (newXp >= newXpNext) {
            newLevel++;
            newXpNext = cumulativeXpForLevel(newLevel + 1);
            result.messages.push(`🎉 Достигнут уровень ${newLevel}!`);
          }

          // 3. Update Artifact Charges
          const newInventory = state.inventory.map(item => {
            if (result.artifactsUsed.includes(item.id)) {
              if (item.charges_left !== undefined) {
                const charges = item.charges_left - 1;
                if (charges <= 0) return null;
                return { ...item, charges_left: charges };
              }
            }
            return item;
          }).filter(Boolean) as PlayerArtifact[];

          const newActive = state.hero.activeArtifacts.filter(
            id => newInventory.find(i => i.id === id)
          );

          // 4. Fire Toast Notifications
          const toast = useToastStore.getState().addToast;

          // XP earned
          if (result.finalXp > 0) {
            toast({ type: 'xp', title: `+${result.finalXp} XP`, message: questName, icon: '⚡' });
          }

          // Gold earned  
          if (result.finalGold > 0) {
            toast({ type: 'gold', title: `+${result.finalGold} Золота`, message: questName, icon: '💰' });
          }

          // Damage taken
          if (result.finalDamage > 0) {
            toast({ type: 'damage', title: `-${result.finalDamage} HP`, message: `Герой получил урон!`, icon: '💔', duration: 5000 });
          }

          // Artifact triggers
          for (const usedId of result.artifactsUsed) {
            const usedItem = state.inventory.find(i => i.id === usedId);
            if (usedItem) {
              const def = ARTIFACT_CATALOG[usedItem.defId];
              if (def) {
                toast({ type: 'artifact', title: `${def.name} сработал!`, message: result.messages.find(m => m.includes(def.name)) || 'Артефакт активирован', icon: '✨', duration: 5000 });
              }
            }
          }

          // Level Up
          if (newLevel > state.hero.level) {
            toast({ type: 'levelup', title: `Уровень ${newLevel}!`, message: 'Поздравляем! Новые возможности открыты!', icon: '🎉', duration: 6000 });
          }

          // Death
          if (newHp <= 0 && !result.preventedDeath) {
            toast({ type: 'death', title: 'Герой пал!', message: 'HP = 0. Герой неактивен до конца сезона.', icon: '💀', duration: 8000 });
          }

          // Death prevented
          if (result.preventedDeath) {
            toast({ type: 'heal', title: 'Смерть отменена!', message: 'Артефакт спас героя от гибели!', icon: '🌟', duration: 6000 });
          }

          // 4. Log Activity
          const newActivity: ActivityEntry = {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString('ru-RU'),
            quest: questName,
            result: result.finalDamage > 0 ? '⚠️ Урон' : '✅ Успех',
            xp: `+${result.finalXp}`,
            gold: `+${result.finalGold}`,
            messages: result.messages
          };

          return {
            hero: {
              ...state.hero,
              hp: newHp,
              xp: newXp,
              level: newLevel,
              xp_to_next: newXpNext,
              gold: state.hero.gold + result.finalGold,
              activeArtifacts: newActive
            },
            inventory: newInventory,
            activity: [newActivity, ...state.activity]
          };
        });
      },
      
      resetProgress: () => {
        set({ hero: initialHero, inventory: initialInventory, activity: initialActivity });
      }
    }),
    {
      name: 'hero-storage',
      // Exclude synced flag — must reset to false on every page load
      partialize: (state) => ({
        hero: state.hero,
        inventory: state.inventory,
        activity: state.activity,
        stats: state.stats,
      }),
    }
  )
);
