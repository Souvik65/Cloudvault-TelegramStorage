import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tg-client';
import { Api } from 'telegram';
import { getSessionFromRequest } from '@/lib/session-cookie';

export async function GET(req: Request) {
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let channelId: string | number = searchParams.get('channelId') || 'me';

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!String(channelId).startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const client = await getClient(sessionString);
    const messages = await client.getMessages(channelId, { ids: [Number(messageId)] });

    if (!messages || messages.length === 0 || !messages[0].document) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const message = messages[0];
    const buffer = await client.downloadMedia(message, {});

    if (!buffer) {
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }

    let contentType = 'application/octet-stream';
    let filename = 'download';

    if (message.document) {
      contentType = message.document.mimeType;
      const attributes = message.document.attributes;
      for (const attr of attributes) {
        if (attr instanceof Api.DocumentAttributeFilename) {
          filename = attr.fileName;
        }
      }
    }

    const bufferData = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as unknown as Uint8Array);
    const safeFilename = filename.replace(/[^\w.\-]/g, '_');
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(bufferData), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': bufferData.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Download file error:', error);
    if (error?.message?.includes('AUTH_KEY_UNREGISTERED') || error?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
