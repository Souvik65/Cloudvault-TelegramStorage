import { NextResponse } from 'next/server';
import { Api } from 'telegram';
import { createRequestId, safeServerError, withRequestId, withTimeout } from '@/lib/api-error';
import { attachSessionCookie, getPendingSessionFromRequest, clearPendingSessionCookie } from '@/lib/session';
import { getClient, updateClientKey, disconnectClient } from '@/lib/tg-client';
import {
  clearAuthFailures,
  consumeFixedWindow,
  getAuthBackoffSeconds,
  getClientIp,
  registerAuthFailure,
} from '@/lib/rate-limit';



export async function POST(req: Request) {
  const requestId = createRequestId();
  let sessionString: string | null = null;
  try {
    const { phoneNumber, phoneCodeHash, phoneCode, password } = await req.json();
    if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      return NextResponse.json(
        withRequestId({ error: 'Phone number is required' }, requestId),
        { status: 400, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } }
      );
    }
    const cleanedPhone = phoneNumber.replace(/[\s\-()]/g, '');
    const ip = getClientIp(req);
    const identityKey = `${cleanedPhone}:${ip}`;

    sessionString = getPendingSessionFromRequest(req);
    if (!sessionString) {
      return NextResponse.json(withRequestId({ error: 'Auth session expired. Please start over.' }, requestId), {
        status: 400,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
      });
    }

    const fixedWindowRate = consumeFixedWindow('auth-sign-in', identityKey, 5, 30 * 60 * 1000);
    if (!fixedWindowRate.allowed) {
      return NextResponse.json(withRequestId({ error: 'Too many sign-in attempts. Please try again later.' }, requestId), {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
          'Retry-After': String(fixedWindowRate.retryAfter),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(fixedWindowRate.remaining),
          'X-RateLimit-Reset': String(fixedWindowRate.resetAt),
        },
      });
    }

    const backoffSeconds = getAuthBackoffSeconds(identityKey);
    if (backoffSeconds > 0) {
      return NextResponse.json(withRequestId({ error: 'Too many failed attempts. Please wait before trying again.' }, requestId), {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
          'Retry-After': String(backoffSeconds),
        },
      });
    }

    const apiId = Number(process.env.TG_API_ID);
    const apiHash = process.env.TG_API_HASH;

    if (!apiId || !apiHash) {
      return NextResponse.json({ error: 'Telegram API credentials not configured' }, { status: 500 });
    }

    {
      console.log(`[SIGN-IN][${requestId}] Calling getClient()...`);
      const client = await withTimeout(getClient(sessionString), 30000, 'Connect timeout', requestId, 'getClient');
      console.log(`[SIGN-IN][${requestId}] Connected successfully!`);

      try {
        if (password) {
          console.log(`[SIGN-IN][${requestId}] Calling signInWithPassword...`);
          await withTimeout(
            client.signInWithPassword(
              { apiId, apiHash },
              { password: async () => password, onError: (err) => { throw err; } }
            ),
            15000,
            'signInWithPassword timeout',
            requestId,
            'signInWithPassword'
          );
          console.log(`[SIGN-IN][${requestId}] signInWithPassword completed.`);
        } else {
          console.log(`[SIGN-IN][${requestId}] Calling Api.auth.SignIn...`);
          await withTimeout(
            client.invoke(
              new Api.auth.SignIn({
                phoneNumber,
                phoneCodeHash,
                phoneCode,
              })
            ),
            15000,
            'SignIn invoke timeout',
            requestId,
            'SignIn'
          );
          console.log(`[SIGN-IN][${requestId}] Api.auth.SignIn completed.`);
        }
      } catch (error: any) {
        if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          return NextResponse.json(withRequestId({ requiresPassword: true }, requestId), {
            headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
          });
        }

        const authErrorCode = error?.errorMessage;
        const isAuthFailure = [
          'PHONE_CODE_INVALID',
          'PHONE_CODE_EXPIRED',
          'PASSWORD_HASH_INVALID',
          'PHONE_NUMBER_INVALID',
          'PHONE_CODE_EMPTY',
        ].includes(authErrorCode);

        if (isAuthFailure) {
          const lockSeconds = registerAuthFailure(identityKey);
          const status = lockSeconds > 0 ? 429 : 401;
          
          let errorMessage = 'Authentication failed';
          if (authErrorCode === 'PHONE_CODE_INVALID') errorMessage = 'Invalid 5-digit code. Please check and try again.';
          if (authErrorCode === 'PHONE_CODE_EXPIRED') errorMessage = 'Code expired. Please request a new one.';
          if (authErrorCode === 'PASSWORD_HASH_INVALID') errorMessage = 'Incorrect 2FA password. Please try again.';
          if (authErrorCode === 'PHONE_NUMBER_INVALID') errorMessage = 'Invalid phone number.';

          const failureResponse = NextResponse.json(withRequestId({
            error: lockSeconds > 0
              ? 'Too many failed attempts. Please wait before trying again.'
              : errorMessage,
            code: authErrorCode
          }, requestId), {
            status,
            headers: {
              'Cache-Control': 'no-store',
              'X-Request-Id': requestId,
              ...(lockSeconds > 0 ? { 'Retry-After': String(lockSeconds) } : {}),
            },
          });

          return failureResponse;
        }

        throw error;
      }

      clearAuthFailures(identityKey);

      const savedSession = client.session.save();
      const newSessionString = typeof savedSession === 'string' ? savedSession : '';
      
      if (!newSessionString) {
        throw new Error('Failed to save authenticated Telegram session');
      }

      // Re-key the cache so the next request (e.g. /api/tg/user) is a cache hit
      updateClientKey(sessionString, newSessionString);

      const response = NextResponse.json(withRequestId({ authenticated: true }, requestId), {
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
      });
      attachSessionCookie(response, newSessionString);
      return clearPendingSessionCookie(response);
    }
  } catch (error: unknown) {
    if (sessionString) {
      disconnectClient(sessionString).catch(() => {});
    }
    return safeServerError('Sign in error', error, requestId);
  }
}
