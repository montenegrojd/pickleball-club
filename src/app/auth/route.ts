import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    // Validate the key
    const validKey = process.env.AUTH_SECRET_KEY;

    if (!validKey) {
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        );
    }

    if (key !== validKey) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Get the proper host from headers (works with proxies and different hosts)
    const host = request.headers.get('host') || 'localhost:8080';
    // Behind cloudflared/Cloud Run x-forwarded-proto is "https"; on a plain LAN request fall back to the request's own scheme.
    const protocol = request.headers.get('x-forwarded-proto') ||
                     new URL(request.url).protocol.replace(':', '');
    
    // Create response with redirect using proper host
    const redirectUrl = `${protocol}://${host}/`;
    const response = NextResponse.redirect(redirectUrl);

    // Set simple auth cookie
    const cookieValue = process.env.AUTH_COOKIE_VALUE || 'authenticated';
    response.cookies.set('pickleball-auth', cookieValue, {
        httpOnly: true,
        secure: protocol === 'https', // allow plain-http LAN testing; https behind cloudflared
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
        path: '/',
    });

    return response;
}
