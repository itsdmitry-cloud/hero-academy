import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createClient } from '@/lib/supabase/server';

// Routes accessible without authentication
const publicRoutes = ['/', '/auth/login', '/auth/join', '/wiki'];

export async function middleware(request: NextRequest) {
  // Always refresh tokens/session
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets
  if (publicRoutes.some(r => pathname === r) || pathname.startsWith('/auth/') || pathname.startsWith('/api/')) {
    return response;
  }

  // Check session
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
