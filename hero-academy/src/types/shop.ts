export type ShopCategory = 'hp_potion' | 'xp_boost' | 'artifact' | 'cosmetic';
export type TransactionType = 'purchase' | 'reward' | 'penalty' | 'teacher_grant' | 'admin_adjust';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  artifact_id: string | null;
  price_gold: number;
  icon: string;
  effect_value: number;
  is_available: boolean;
  stock_limit: number | null;
  season_id: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  hero_id: string;
  type: TransactionType;
  item_type: string;
  amount: number;
  shop_item_id: string | null;
  description: string;
  created_by: string | null;
  created_at: string;
}
