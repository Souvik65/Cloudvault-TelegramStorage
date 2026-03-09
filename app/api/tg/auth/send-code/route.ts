import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export async function POST(req: Request) {
  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    if (!/^\+\d{7,15}$/.test(cleaned)) {
      return NextResponse.json({ error: 'Invalid phone number format. Use international format: +1234567890' }, { status: 400 });
    }

    const apiId = Number(process.env.TG_API_ID);
    const apiHash = process.env.TG_API_HASH;

    if (!apiId || !apiHash) {
      return NextResponse.json({ error: 'Telegram API credentials not configured' }, { status: 500 });
    }

    const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5, requestRetries: 3 });
    client.setLogLevel("none" as any);
    try {
      await client.connect();

      const result = await client.sendCode(
        { apiId, apiHash },
        phoneNumber
      );

      const sessionString = client.session.save() as unknown as string;

      return NextResponse.json({ phoneCodeHash: result.phoneCodeHash, sessionString });
    } finally {
      try { await client.disconnect(); } catch {}
    }
  } catch (error: any) {
    console.error('Send code error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
