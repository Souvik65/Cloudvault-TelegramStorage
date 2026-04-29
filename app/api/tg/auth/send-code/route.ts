import { NextResponse } from 'next/server';
import { createRequestId, safeServerError, withRequestId, withTimeout } from '@/lib/api-error';
import { getClientIp, consumeFixedWindow } from '@/lib/rate-limit';
import { getClient, updateClientKey, disconnectClient } from '@/lib/tg-client';
import { attachPendingSessionCookie } from '@/lib/session';

export async function POST(req: Request) {
  const requestId = createRequestId();
  let tempKey = '';
  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    if (!/^\+\d{7,15}$/.test(cleaned)) {
      return NextResponse.json({ error: 'Invalid phone number format. Use international format: +1234567890' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const rate = consumeFixedWindow('auth-send-code', `${ip}:${cleaned}`, 3, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(withRequestId({ error: 'Too many code requests. Please try again later.' }, requestId), {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
          'Retry-After': String(rate.retryAfter),
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': String(rate.remaining),
          'X-RateLimit-Reset': String(rate.resetAt),
        },
      });
    }

    const apiId = Number(process.env.TG_API_ID);
    const apiHash = process.env.TG_API_HASH;

    if (!apiId || !apiHash) {
      return NextResponse.json({ error: 'Telegram API credentials not configured' }, { status: 500 });
    }

    // Use a unique temporary key based on requestId to avoid race conditions 
    // between concurrent auth attempts. 
    tempKey = `pending:${requestId}`;
    console.log(`[SEND-CODE][${requestId}] Calling getClient()...`);
    const client = await withTimeout(getClient(tempKey), 15000, 'Telegram connect timeout', requestId, 'getClient');
    console.log(`[SEND-CODE][${requestId}] Connected.`);

    const result = await withTimeout(
      client.sendCode({ apiId, apiHash }, phoneNumber),
      15000,
      'sendCode timeout',
      requestId,
      'sendCode'
    );

    // After sendCode, gramJS has assigned a real DC/session. Save it and
    // re-key the cache from our temp key to the real session string.
    const savedSession = client.session.save();
    const sessionString = typeof savedSession === 'string' ? savedSession : '';
    
    if (!sessionString) {
      throw new Error('Failed to generate Telegram session string');
    }

    updateClientKey(tempKey, sessionString);

    const response = NextResponse.json(withRequestId({ phoneCodeHash: result.phoneCodeHash }, requestId), {
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    });

    return attachPendingSessionCookie(response, sessionString);
  } catch (error: unknown) {
    if (tempKey) {
      disconnectClient(tempKey).catch(() => {});
    }
    return safeServerError('Send code error', error, requestId);
  }
}

