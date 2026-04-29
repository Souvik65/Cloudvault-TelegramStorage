import { NextResponse } from 'next/server';
import { createRequestId, withRequestId } from '@/lib/api-error';
import { clearSessionCookie } from '@/lib/session';

export async function POST() {
  const requestId = createRequestId();
  const response = NextResponse.json(withRequestId({ success: true }, requestId), {
    headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
  });
  return clearSessionCookie(response);
}
