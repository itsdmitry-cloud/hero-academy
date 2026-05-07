import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes accessible without authentication
const publicRoutes = ['/', '/landing.html', '/auth/login', '/auth/join', '/wiki'];

export async function middleware(request: NextRequest) {
  // Refresh tokens/session and get the authenticated user in one pass
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets
  if (publicRoutes.some(r => pathname === r) || pathname.startsWith('/auth/') || pathname.startsWith('/api/')) {
    return response;
  }

  // Redirect to login if no authenticated user
  if (!user) {
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
