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

    // Create response with redirect
    const response = NextResponse.redirect(new URL('/', request.url));

    // Set simple auth cookie
    response.cookies.set('pickleball-auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
        path: '/',
    });

    return response;
}
