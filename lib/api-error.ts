import { NextResponse } from 'next/server';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export function createRequestId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function isAuthKeyUnregistered(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const err = error as { message?: string; errorMessage?: string };
  return err.errorMessage === 'AUTH_KEY_UNREGISTERED' || err.message?.includes('AUTH_KEY_UNREGISTERED');}

export function safeServerError(
  context: string,
  error: unknown,
  requestId: string,
  fallbackMessage = 'Request failed'
) {
  console.error(`[${context}] requestId=${requestId}`, error);
  return NextResponse.json(
    { error: fallbackMessage, requestId },
    {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    }
  );
}

export function safeUnauthorizedSession(requestId: string) {
  return NextResponse.json(
    { error: 'Unauthorized: Session expired', requestId },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    }
  );
}

export function withRequestId<T extends JsonObject>(payload: T, requestId: string) {
  return {
    ...payload,
    requestId,
  };
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Standardized timeout wrapper for async operations.
 * Logs orphaned operations that finish after the timeout has fired.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  requestId?: string,
  context?: string
): Promise<T> {
  let finished = false;
  return new Promise<T>((resolve, reject) => {    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new TimeoutError(timeoutMessage));
      }
    }, timeoutMs);

    promise
      .then((value) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(value);
        } else if (requestId) {
          console.warn(`[TIMEOUT][${requestId}] Orphaned operation "${context || 'unknown'}" resolved after timeout.`);
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        } else if (requestId) {
          console.warn(`[TIMEOUT][${requestId}] Orphaned operation "${context || 'unknown'}" rejected after timeout:`, err?.message || err);
        }
      });
  });
}