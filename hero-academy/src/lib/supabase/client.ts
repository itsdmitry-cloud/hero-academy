import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Browser uses the proxy URL (db2.hero-academy.ru) to bypass Russian ISP
// blocks of *.supabase.co. Server-side code talks to Supabase directly via
// NEXT_PUBLIC_SUPABASE_URL — Vercel datacenters aren't blocked. Cookie name
// is pinned so server and browser read/write the same auth cookie regardless
// of which hostname each uses.
const SUPABASE_AUTH_COOKIE = 'sb-hero-academy-auth-token';

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (!browserClient) {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL!;
    browserClient = createBrowserClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: { name: SUPABASE_AUTH_COOKIE } }
    );
  }
  return browserClient;
}
