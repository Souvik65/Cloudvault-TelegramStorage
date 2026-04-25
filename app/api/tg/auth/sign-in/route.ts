import { NextResponse } from 'next/server';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { setSessionCookie } from '@/lib/session-cookie';

export async function POST(req: Request) {
  try {
    const { phoneNumber, phoneCodeHash, phoneCode, password, sessionString } = await req.json();
    const apiId = Number(process.env.TG_API_ID);
    const apiHash = process.env.TG_API_HASH;

    if (!apiId || !apiHash) {
      return NextResponse.json({ error: 'Telegram API credentials not configured' }, { status: 500 });
    }

    const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 5, requestRetries: 3 });
    client.setLogLevel('none' as any);
    try {
      await client.connect();

      try {
        if (password) {
          await client.signInWithPassword(
            { apiId, apiHash },
            { password: async () => password, onError: (err) => { throw err; } }
          );
        } else {
          await client.invoke(
            new Api.auth.SignIn({
              phoneNumber,
              phoneCodeHash,
              phoneCode,
            })
          );
        }
      } catch (error: any) {
        if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          return NextResponse.json({ requiresPassword: true });
        }
        throw error;
      }

      const newSessionString = client.session.save() as unknown as string;

      // Set the session as an HttpOnly cookie — never exposed to client-side JS
      const res = NextResponse.json({ success: true });
      return setSessionCookie(res, newSessionString);
    } finally {
      try { await client.disconnect(); } catch {}
    }
  } catch (error: any) {
    console.error('Sign in error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
