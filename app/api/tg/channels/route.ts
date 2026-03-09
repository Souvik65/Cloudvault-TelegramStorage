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
    const dialogs = await client.getDialogs();

    const channels = dialogs
      .filter((dialog) => dialog.isChannel && dialog.entity)
      .map((dialog) => {
        const entity = dialog.entity as any;
        if (!entity) return null;
        return {
          id: entity.id ? entity.id.toString() : null,
          title: entity.title || 'Untitled',
          isCreator: !!entity.creator,
          isAdmin: !!entity.adminRights,
        };
      })
      .filter((channel): channel is NonNullable<typeof channel> =>
        channel !== null && (channel.isCreator || channel.isAdmin) && !!channel.id
      );

    return NextResponse.json({ channels });
  } catch (error: any) {
    console.error('Get channels error:', error);
    if (error?.message?.includes('AUTH_KEY_UNREGISTERED') || error?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionString = req.headers.get('x-tg-session');
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const client = await getClient(sessionString);

    const result = await client.invoke(
      new Api.channels.CreateChannel({
        title: name,
        about: 'CloudVault storage channel',
        megagroup: false,
      })
    );

    const updates = result as Api.Updates;
    if (!updates.chats || updates.chats.length === 0) {
      return NextResponse.json({ error: 'Channel creation failed: no channel returned' }, { status: 500 });
    }
    const channel = updates.chats[0] as Api.Channel;
    if (!channel?.id) {
      return NextResponse.json({ error: 'Channel creation failed: invalid channel data' }, { status: 500 });
    }

    return NextResponse.json({ channelId: channel.id.toString() });
  } catch (error: any) {
    console.error('Create channel error:', error);
    if (error?.message?.includes('AUTH_KEY_UNREGISTERED') || error?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
