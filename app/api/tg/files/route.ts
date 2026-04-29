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
    let channelId = searchParams.get('channelId');

    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId)) && Number(channelId) > 0) {
      if (!channelId.startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const client = await getClient(sessionString);

    let peer: any = channelId;
    if (channelId !== 'me') {
      try {
        peer = await client.getInputEntity(channelId as any);
      } catch {
        try {
          await client.getDialogs({ limit: 100 });
          peer = await client.getInputEntity(channelId as any);
        } catch (e2: any) {
          console.error(`[Files] Channel lookup error for ${channelId}:`, e2?.message);
          return NextResponse.json(
            withRequestId({ error: 'Channel not found' }, requestId),
            { status: 404, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }
    }

    const limit = 500;
    const offsetIdParam = searchParams.get('offsetId');
    const offsetId = offsetIdParam ? Number(offsetIdParam) : undefined;

    if (offsetIdParam && (isNaN(offsetId!) || offsetId! < 0)) {
      return NextResponse.json(
        withRequestId({ error: 'Invalid offsetId parameter' }, requestId),
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const batch = [];
    for await (const msg of client.iterMessages(peer, { 
      limit,
      offsetId,
    })) {
      batch.push(msg);
    }

    const nextOffsetId = batch.length === limit ? batch[batch.length - 1]?.id : null;
    const hasMore = nextOffsetId !== null;

    const files = [];

    for (const msg of batch) {
      if (msg.document) {
        let name = `file-${msg.id}`;
        let folderPath = '/';
        let uploadDate = msg.date ? msg.date * 1000 : Date.now();
        let extraMeta: Record<string, any> = {};
        let isDirectUpload = true;

        try {
          const text = msg.message || '';
          if (text.startsWith('{') && text.endsWith('}')) {
            const parsed = JSON.parse(text);
            name = parsed.name || name;
            folderPath = parsed.folderPath || folderPath;
            uploadDate = parsed.uploadDate || uploadDate;
            const { name: _n, folderPath: _f, uploadDate: _u, ...rest } = parsed;
            extraMeta = rest;
            isDirectUpload = false;
          }
        } catch (parseError) {
          // Non-JSON message, skip silently
        }

        if (isDirectUpload) {
          const docAttrs = msg.document.attributes || [];
          const filenameAttr = docAttrs.find(
            (a: any) => a.className === 'DocumentAttributeFilename'
          ) as any;
          if (filenameAttr?.fileName) {
            name = filenameAttr.fileName;
          }
        }

        files.push({
          id: msg.id,
          date: msg.date,
          name,
          folderPath,
          uploadDate,
          ...extraMeta,
          hasDocument: true,
          isDirectUpload,
          size: Number(msg.document.size),
          mimeType: msg.document.mimeType,
        });
      } else if (msg.message) {
        try {
          const text = msg.message;
          if (text.startsWith('{') && text.endsWith('}')) {
            const metadata = JSON.parse(text);
            files.push({
              id: msg.id,
              date: msg.date,
              ...metadata,
              hasDocument: false,
              size: 0,
              mimeType: 'folder',
            });
          }
        } catch {}
      }
    }
    
    // Final response with pagination info

    return NextResponse.json({ 
      files,
      pagination: {
        hasMore,
        nextOffsetId,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    if (isAuthKeyUnregistered(error)) {
      return safeUnauthorizedSession(requestId);
    }
    return safeServerError('Get files error', error, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return safeUnauthorizedSession(requestId);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    let channelId: string | number = formData.get('channelId') as string;

    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!String(channelId).startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const metadataStr = formData.get('metadata') as string;

    if (!metadataStr) {
      return NextResponse.json(withRequestId({ error: 'Missing metadata' }, requestId), { 
        status: 400,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId }
      });
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataStr);
    } catch {
      return NextResponse.json(withRequestId({ error: 'Invalid metadata format' }, requestId), { 
        status: 400,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId }
      });
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      return NextResponse.json(withRequestId({ error: 'Metadata must include a valid name' }, requestId), { 
        status: 400,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId }
      });
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

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    if (isAuthKeyUnregistered(error)) {
      return safeUnauthorizedSession(requestId);
    }
    return safeServerError('Upload file error', error, requestId);
  }
}

export async function DELETE(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return safeUnauthorizedSession(requestId);
    }

    const { searchParams } = new URL(req.url);
    let channelId: string | number = searchParams.get('channelId') ?? 'me';

    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!String(channelId).startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const messageIdsStr = searchParams.get('messageIds');

    if (!messageIdsStr) {
      return NextResponse.json(withRequestId({ error: 'Missing messageIds' }, requestId), { 
        status: 400,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId }
      });
    }

    const messageIds = messageIdsStr.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
    const client = await getClient(sessionString);

    await client.deleteMessages(channelId, messageIds, { revoke: true });

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    if (isAuthKeyUnregistered(error)) {
      return safeUnauthorizedSession(requestId);
    }
    return safeServerError('Delete file error', error, requestId);
  }
}
