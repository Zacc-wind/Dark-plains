import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Page navigations only: API routes validate the session themselves, and assets never need it.
    '/((?!api(?:/|$)|_next/|favicon\\.ico$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp3|ogg|wav|ico|woff2?|css|js|json|txt)$).*)',
  ],
};
