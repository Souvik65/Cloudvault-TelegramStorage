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
    let channelId: string | number = searchParams.get('channelId') ?? 'me';

    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!String(channelId).startsWith('-100')) {
        channelId = '-100' + channelId;
      }
    }

    const client = await getClient(sessionString);

    // Resolve the entity first — GramJS requires this for numeric channel IDs
    // that aren't already cached in the session.
    let peer: any = channelId;
    if (channelId !== 'me') {
      try {
        peer = await client.getInputEntity(channelId as any);
      } catch {
        // If we can't resolve, try fetching dialogs to populate the cache, then retry
        try {
          await client.getDialogs({ limit: 200 });
          peer = await client.getInputEntity(channelId as any);
        } catch (e2: any) {
          if (e2?.message?.includes('AUTH_KEY_UNREGISTERED') || e2?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
            throw e2;
          }
          return NextResponse.json(
            { error: `Channel not found: ${e2?.message ?? channelId}` },
            { status: 404 }
          );
        }
      }
    }

    // Paginate through all messages to get every file in the channel
    const allMessages = [];
    let offsetId = 0;
    while (true) {
      const batch = await client.getMessages(peer, { limit: 100, offsetId });
      if (!batch.length) break;
      allMessages.push(...batch);
      offsetId = batch[batch.length - 1].id;
      // If we got fewer than 100, we've reached the beginning
      if (batch.length < 100) break;
    }


    const files = [];

    for (const msg of allMessages) {
      // Include any message that has a document (file uploaded via app or directly to Telegram)
      if (msg.document) {
        let name = `file-${msg.id}`;
        let folderPath = '/';
        let uploadDate = msg.date ? msg.date * 1000 : Date.now();
        let extraMeta: Record<string, any> = {};
        let isDirectUpload = true;

        // Try to parse app-specific metadata from caption
        try {
          const text = msg.message || '';
          if (text.startsWith('{') && text.endsWith('}')) {
            const parsed = JSON.parse(text);
            name = parsed.name || name;
            folderPath = parsed.folderPath || folderPath;
            uploadDate = parsed.uploadDate || uploadDate;
            // Spread any other app metadata fields
            const { name: _n, folderPath: _f, uploadDate: _u, ...rest } = parsed;
            extraMeta = rest;
            isDirectUpload = false; // Has app metadata → uploaded via this app
          }
        } catch {
          // Not app metadata — use fallback values derived from the document itself
        }

        // Always try to get filename from document attributes as fallback
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
        // Text-only messages that contain app metadata (e.g. folder entries)
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
        } catch {
          // Plain text message, not a file/folder entry — skip
        }
      }
    }

    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('Get files error:', error);
    if (error?.message?.includes('AUTH_KEY_UNREGISTERED') || error?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    if (error?.message?.includes('AUTH_KEY_UNREGISTERED') || error?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Missing messageIds' }, { status: 400 });
    }

    const messageIds = messageIdsStr.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
    const client = await getClient(sessionString);

    await client.deleteMessages(channelId, messageIds, { revoke: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete file error:', error);
    if (error?.message?.includes('AUTH_KEY_UNREGISTERED') || error?.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
