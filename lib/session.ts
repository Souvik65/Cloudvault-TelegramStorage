import { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'tg_session';
export const SESSION_PENDING_COOKIE_NAME = 'tg_auth_pending';

function parseCookies(cookieHeader: string) {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex);
    const raw = trimmed.slice(eqIndex + 1);
    try {
      cookies[key] = decodeURIComponent(raw);
    } catch {
      cookies[key] = raw;
    }
  }
  return cookies;
}

export function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const cookieSession = cookies[SESSION_COOKIE_NAME];
  if (cookieSession) return cookieSession;
  return null;
}

export function getPendingSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const cookieSession = cookies[SESSION_PENDING_COOKIE_NAME];
  if (cookieSession) return cookieSession;
  return null;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export function attachSessionCookie(response: NextResponse, sessionString: string): NextResponse {
  response.cookies.set({
    ...COOKIE_OPTIONS,
    name: SESSION_COOKIE_NAME,
    value: sessionString,
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function attachPendingSessionCookie(response: NextResponse, sessionString: string): NextResponse {
  response.cookies.set({
    ...COOKIE_OPTIONS,
    name: SESSION_PENDING_COOKIE_NAME,
    value: sessionString,
    maxAge: 60 * 15,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export function clearPendingSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_PENDING_COOKIE_NAME);
  return response;
}
