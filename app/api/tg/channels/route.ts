import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tg-client';
import { Api } from 'telegram';
import { createRequestId, isAuthKeyUnregistered, safeServerError, safeUnauthorizedSession, withRequestId } from '@/lib/api-error';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return safeUnauthorizedSession(requestId);
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

    return NextResponse.json({ channels }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    if (isAuthKeyUnregistered(error)) {
      return safeUnauthorizedSession(requestId);
    }
    return safeServerError('Get channels error', error, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return safeUnauthorizedSession(requestId);
    }

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(withRequestId({ error: 'Invalid JSON body' }, requestId), { status: 400 });
    }

    const { name } = body;
    if (!name) {
      return NextResponse.json(withRequestId({ error: 'Name is required' }, requestId), { status: 400 });
    }

    const client = await getClient(sessionString);

    const result = await client.invoke(
      new Api.channels.CreateChannel({
        title: name,
        about: 'StorageVault storage channel',
        megagroup: false,
      })
    );

    const updates = result as Api.Updates;
    if (!updates.chats || updates.chats.length === 0) {
      return NextResponse.json(withRequestId({ error: 'Channel creation failed: no channel returned' }, requestId), { status: 500 });
    }
    const channel = updates.chats[0] as Api.Channel;
    if (!channel?.id) {
      return NextResponse.json(withRequestId({ error: 'Channel creation failed: invalid channel data' }, requestId), { status: 500 });
    }

    return NextResponse.json({ channelId: channel.id.toString() }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    if (isAuthKeyUnregistered(error)) {
      return safeUnauthorizedSession(requestId);
    }
    return safeServerError('Create channel error', error, requestId);
  }
}
