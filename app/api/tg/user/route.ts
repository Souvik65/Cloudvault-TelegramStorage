import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tg-client';
import { Api } from 'telegram';
import { createRequestId, isAuthKeyUnregistered, safeServerError, safeUnauthorizedSession, withRequestId, withTimeout, TimeoutError } from '@/lib/api-error';
import { getSessionFromRequest } from '@/lib/session';

const PROFILE_PHOTO_TIMEOUT_MS = 2000;
const SESSION_CHECK_TIMEOUT_MS = 12000;

async function downloadProfilePhotoWithTimeout(
  client: Awaited<ReturnType<typeof getClient>>,
  requestId: string
): Promise<Buffer | null> {
  try {
    return await withTimeout(
      client.downloadProfilePhoto('me', { isBig: false }) as Promise<Buffer | null>,
      PROFILE_PHOTO_TIMEOUT_MS,
      'Profile photo timeout',
      requestId,
      'downloadProfilePhoto'
    );
  } catch (err) {
    if (err instanceof TimeoutError) {
      return null;
    }
    throw err;
  }
}

export async function GET(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return safeUnauthorizedSession(requestId);
    }

    const client = await withTimeout(
      getClient(sessionString),
      SESSION_CHECK_TIMEOUT_MS,
      'Session initialization timeout',
      requestId,
      'getClient'
    );
    const me = await withTimeout(
      client.getMe(),
      SESSION_CHECK_TIMEOUT_MS,
      'Session verification timeout',
      requestId,
      'getMe'
    );

    if (!me) {
      return safeUnauthorizedSession(requestId);
    }

    let profilePhoto = undefined;
    try {
      const buffer = await downloadProfilePhotoWithTimeout(client, requestId);
      if (buffer) {
        profilePhoto = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }
    } catch (e) {
      console.error('Failed to download profile photo:', e);
    }

    return NextResponse.json(withRequestId({
      id: me.id.toString(),
      username: me.username ?? null,
      firstName: me.firstName ?? null,
      lastName: me.lastName ?? null,
      phone: me.phone ?? null,
      profilePhoto: profilePhoto ?? null,
    }, requestId), {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    if (error instanceof TimeoutError) {
      return NextResponse.json(
        { error: 'Session check timeout', requestId },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'X-Request-Id': requestId,
          },
        }
      );
    }
    if (isAuthKeyUnregistered(error)) {
      return safeUnauthorizedSession(requestId);
    }
    return safeServerError('Get user error', error, requestId);
  }
}
