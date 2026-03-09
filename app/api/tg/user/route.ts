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

    let profilePhoto = undefined;
    try {
      const buffer = await client.downloadProfilePhoto('me', { isBig: false });
      if (buffer) {
        profilePhoto = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }
    } catch (e) {
      console.error('Failed to download profile photo:', e);
    }

    return NextResponse.json({
      id: me.id.toString(),
      username: me.username,
      firstName: me.firstName,
      lastName: me.lastName,
      phone: me.phone,
      profilePhoto,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    if (error?.message?.includes('AUTH_KEY_UNREGISTERED') || error?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
