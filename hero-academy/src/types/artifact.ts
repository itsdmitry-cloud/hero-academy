export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ArtifactSource = 'drop' | 'shop' | 'reward' | 'teacher_gift' | 'streak_reward' | 'lootbox' | 'boss';

export interface Artifact {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
  effect: string;           // e.g. 'xp_boost', 'hp_restore', 'damage_shield', 'lootbox' ...
  effect_value: number;
  artifact_type?: string;   // 'passive' | 'consumable' | 'cosmetic'
  duration_hours: number | null;
  max_charges: number | null;
  min_level: number;
  season_id: string | null;
  stackable: boolean;
  is_shopable: boolean;
  created_at: string;
}

export interface HeroArtifact {
  id: string;
  hero_id: string;
  artifact_id: string;
  slot_index: number | null;
  is_equipped: boolean;
  quantity: number;
  charges_remaining: number | null;
  acquired_at: string;
  expires_at: string | null;
  source: ArtifactSource;
  artifact?: Artifact;
}
