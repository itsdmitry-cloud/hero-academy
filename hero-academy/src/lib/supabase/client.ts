import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Module-level singleton: createClient() возвращает ОДИН и тот же объект
// на всё приложение. Без этого каждый ререндер любого хука создавал новый
// клиент, что ломало стабильность useCallback deps и приводило к
// бесконечным циклам useEffect → fetch → setState → render → fetch.
// Это рекомендованный Supabase паттерн для браузерных клиентов.
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
