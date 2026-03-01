import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tg-client';
import { Api } from 'telegram';

export async function GET(req: Request) {
  try {
    const sessionString = req.headers.get('x-tg-session');
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getClient(sessionString);
    const me = await client.getMe();

    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      id: me.id.toString(),
      username: me.username,
      firstName: me.firstName,
      lastName: me.lastName,
      phone: me.phone,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
