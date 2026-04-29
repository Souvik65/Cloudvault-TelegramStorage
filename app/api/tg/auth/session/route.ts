import { NextResponse } from 'next/server';
import { createRequestId, safeServerError, safeUnauthorizedSession, withRequestId } from '@/lib/api-error';
import { getSessionFromRequest } from '@/lib/session';
import { getClient } from '@/lib/tg-client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return safeUnauthorizedSession(requestId);
    }

    try {
      const client = await getClient(sessionString);
      const me = await client.getMe();
      
      if (!me) {
        return safeUnauthorizedSession(requestId);
      }

      return NextResponse.json(withRequestId({
        authenticated: true,
        user: {
          id: me.id.toString(),
          firstName: me.firstName ?? null,
          lastName: me.lastName ?? null,
          username: me.username ?? null,
        }
      }, requestId), {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'X-Request-Id': requestId,
        }
      });
    } catch (error: any) {
      const errorMessage = String(error?.errorMessage || error?.message || '');
      
      // If session is invalid, expired, or explicitly unauthorized
      const isAuthError = 
        errorMessage === 'AUTH_KEY_UNREGISTERED' || 
        errorMessage === 'SESSION_EXPIRED' ||
        errorMessage === 'SESSION_REVOKED' ||
        errorMessage.toLowerCase().includes('not logged in');

      if (isAuthError) {
        return safeUnauthorizedSession(requestId);
      }
      throw error;
    }
  } catch (error: unknown) {
    return safeServerError('Session verification error', error, requestId);
  }
}
