import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    
    console.log('[PROXY] Running for:', pathname);

    // Allow access to auth route and static files
    if (
        pathname.startsWith('/auth') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/unauthorized') ||
        pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp)$/)
    ) {
        console.log('[PROXY] Allowing through:', pathname);
        return NextResponse.next();
    }

    // Check for auth cookie
    const authCookie = request.cookies.get('pickleball-auth')?.value;
    console.log('[PROXY] Cookie value:', authCookie);

    if (!authCookie || authCookie !== 'authenticated') {
        console.log('[PROXY] No valid cookie, redirecting to /unauthorized');
        return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    console.log('[PROXY] Authenticated, allowing through');
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
