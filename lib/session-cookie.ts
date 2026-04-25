// lib/session-cookie.ts
// Shared helpers for the HttpOnly tg-session cookie.
// The cookie is NEVER exposed to client-side JS (HttpOnly flag).

import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'tg-session';

const isProduction = process.env.NODE_ENV === 'production';

/** Read the session string from an incoming request's cookies. */
export function getSessionFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
}

/** Attach a Set-Cookie header to a NextResponse to persist the session. */
export function setSessionCookie(res: NextResponse, sessionString: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, encodeURIComponent(sessionString), {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    // 30-day expiry — mirrors Telegram's own session lifetime
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/** Attach a Set-Cookie header that immediately expires the session cookie. */
export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return res;
}
