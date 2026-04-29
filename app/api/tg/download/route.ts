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

    const { searchParams } = new URL(req.url);
    let channelId: string | number = searchParams.get('channelId') || 'me';

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!String(channelId).startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(withRequestId({ error: 'Missing messageId' }, requestId), { 
        status: 400,
        headers: { 'X-Request-Id': requestId }
      });
    }

    const client = await getClient(sessionString);
    const messages = await client.getMessages(channelId, { ids: [Number(messageId)] });

    if (!messages || messages.length === 0 || !messages[0].document) {
      return NextResponse.json(withRequestId({ error: 'File not found' }, requestId), { 
        status: 404,
        headers: { 'X-Request-Id': requestId }
      });
    }

    const message = messages[0];
    const buffer = await client.downloadMedia(message, {});

    if (!buffer) {
      return NextResponse.json(withRequestId({ error: 'Failed to download file' }, requestId), { 
        status: 500,
        headers: { 'X-Request-Id': requestId }
      });
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
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    if (isAuthKeyUnregistered(error)) {
      return safeUnauthorizedSession(requestId);
    }
    return safeServerError('Download file error', error, requestId);
  }
}
