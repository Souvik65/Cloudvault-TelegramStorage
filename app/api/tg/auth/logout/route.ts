import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session-cookie';

export async function POST() {
  const res = NextResponse.json({ success: true });
  return clearSessionCookie(res);
}
