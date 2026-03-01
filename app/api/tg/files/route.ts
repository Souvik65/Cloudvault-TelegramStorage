import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tg-client';
import { Api } from 'telegram';

export async function GET(req: Request) {
  try {
    const sessionString = req.headers.get('x-tg-session');
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let channelId: string | number | any = searchParams.get('channelId');

    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!channelId.startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const client = await getClient(sessionString);

    const messages = await client.getMessages(channelId, { limit: 1000 });

    const files = [];

    for (const msg of messages) {
      if (msg.document || msg.message) {
        let metadata = null;
        try {
          const text = msg.message || '';
          if (text.startsWith('{') && text.endsWith('}')) {
            metadata = JSON.parse(text);
          }
        } catch (e) {
          // Include file with fallback metadata so it's not hidden
          metadata = {
            name: `message-${msg.id}`,
            folderPath: '/',
            uploadDate: msg.date ? msg.date * 1000 : Date.now(),
          };
        }

        if (metadata) {
          files.push({
            id: msg.id,
            date: msg.date,
            ...metadata,
            hasDocument: !!msg.document,
            size: msg.document ? msg.document.size.toJSNumber() : 0,
            mimeType: msg.document ? msg.document.mimeType : 'folder',
          });
        }
      }
    }

    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('Get files error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionString = req.headers.get('x-tg-session');
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    let channelId: string | number | any = formData.get('channelId') as string;

    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!channelId.startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const metadataStr = formData.get('metadata') as string;

    if (!metadataStr) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataStr);
    } catch {
      return NextResponse.json({ error: 'Invalid metadata format' }, { status: 400 });
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      return NextResponse.json({ error: 'Metadata must include a valid name' }, { status: 400 });
    }

    const client = await getClient(sessionString);

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await client.sendFile(channelId, {
        file: buffer,
        caption: metadataStr,
        forceDocument: true,
        attributes: [
          new Api.DocumentAttributeFilename({ fileName: file.name }),
        ],
      });
    } else {
      await client.sendMessage(channelId, {
        message: metadataStr,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Upload file error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sessionString = req.headers.get('x-tg-session');
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let channelId: string | number | any = searchParams.get('channelId');

    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!channelId.startsWith('-100')) {
        channelId = '-100' + channelId;
      }
      try {
        channelId = BigInt(channelId);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid channel ID' }, { status: 400 });
      }
    }

    const messageIdsStr = searchParams.get('messageIds');

    if (!messageIdsStr) {
      return NextResponse.json({ error: 'Missing messageIds' }, { status: 400 });
    }

    const messageIds = messageIdsStr.split(',').map(Number);
    const client = await getClient(sessionString);

    await client.deleteMessages(channelId, messageIds, { revoke: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
