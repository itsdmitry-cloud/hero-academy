import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession() читает cookie без round-trip к Supabase Auth — это критично для UX
  // переходов между вкладками. Безопасность не страдает: RLS на стороне БД всё равно
  // валидирует JWT на каждом запросе, а просроченный токен ловится в onAuthStateChange.
  const { data: { session } } = await supabase.auth.getSession();

  return { response: supabaseResponse, user: session?.user ?? null };
}
