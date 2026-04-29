import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tg-client';
import { createRequestId, isAuthKeyUnregistered, safeServerError, safeUnauthorizedSession, withRequestId, withTimeout, TimeoutError } from '@/lib/api-error';
import { getSessionFromRequest } from '@/lib/session';

const IMAGE_EXTS = new Set(['jpg','jpeg','png','webp','avif','svg','heic','gif','bmp','tiff']);
const VIDEO_EXTS = new Set(['mp4','mkv','avi','mov','wmv','flv','webm','m4v','3gp']);
const DOC_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain','text/csv','application/rtf',
]);
const DOC_EXTS = new Set(['pdf','doc','docx','ppt','pptx','xls','xlsx','csv','txt','rtf','odt','ods','odp']);
const getExt = (name: string) => name?.split('.').pop()?.toLowerCase() ?? '';

export async function GET(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) return safeUnauthorizedSession(requestId);

    const { searchParams } = new URL(req.url);
    let channelId = searchParams.get('channelId');
    if (!channelId || channelId === 'undefined' || channelId === 'null') {
      channelId = 'me';
    }

    if (channelId !== 'me' && !isNaN(Number(channelId))) {
      if (!channelId.startsWith('-100')) {
        channelId = `-100${channelId}`;
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
          console.error(`[Stats] Channel lookup error for ${channelId}:`, e2?.message);
          return NextResponse.json(
            withRequestId({ error: 'Channel not found' }, requestId),
            { status: 404, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }
    }

    interface StatsResult {
      totalSize: bigint;
      images: number;
      videos: number;
      documents: number;
      others: number;
      folderCounts: Record<string, number>;
    }

    const statsData = await withTimeout<StatsResult>((async () => {
      let totalSize = BigInt(0);
      let images = 0;
      let videos = 0;
      let documents = 0;
      let others = 0;
      const folderCounts: Record<string, number> = {};

      for await (const msg of client.iterMessages(peer, { limit: undefined })) {
        // Count folder file memberships (from JSON metadata messages)
        if (!msg.document && msg.message) {
          try {
            const text = msg.message;
            if (text.startsWith('{') && text.endsWith('}')) {
              const meta = JSON.parse(text);
              if (meta.folderPath && meta.name) {
                const fp: string = meta.folderPath;
                folderCounts[fp] = (folderCounts[fp] ?? 0) + 1;
              }
            }
          } catch (err) {
            console.warn(`[Stats] Metadata parse error in message ${msg.id}:`, err);
          }
          continue;
        }

        if (!msg.document) continue;

        const size = BigInt(msg.document.size?.toString() ?? '0');
        const mime: string = msg.document.mimeType ?? '';
        const attrs = msg.document.attributes ?? [];
        const fnAttr = attrs.find((a: any) => a.className === 'DocumentAttributeFilename') as any;
        const ext = getExt(fnAttr?.fileName ?? '');

        // Determine folderPath from caption JSON if available
        let fileFolderPath = '/';
        if (msg.message) {
          try {
            const text = msg.message;
            if (text.startsWith('{') && text.endsWith('}')) {
              const meta = JSON.parse(text);
              if (meta.folderPath) fileFolderPath = meta.folderPath;
            }
          } catch { /* skip */ }
        }

        totalSize += size;
        if (IMAGE_EXTS.has(ext) || mime.startsWith('image/')) images++;
        else if (VIDEO_EXTS.has(ext) || mime.startsWith('video/')) videos++;
        else if (DOC_EXTS.has(ext) || DOC_MIMES.has(mime)) documents++;
        else others++;

        if (fileFolderPath !== '/') {
          folderCounts[fileFolderPath] = (folderCounts[fileFolderPath] ?? 0) + 1;
        }
      }

      return { totalSize, images, videos, documents, others, folderCounts };
    })(), 25000, 'Calculating storage statistics took too long. Try again later.', requestId, 'Get Stats');

    return NextResponse.json(withRequestId({
      totalSize: statsData.totalSize.toString(),
      images: statsData.images,
      videos: statsData.videos,
      documents: statsData.documents,
      others: statsData.others,
      folderCounts: statsData.folderCounts,
    }, requestId), {
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId }
    });
  } catch (error: any) {
    if (error instanceof TimeoutError) {
      return NextResponse.json(
        withRequestId({ error: error.message }, requestId),
        { status: 504, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (isAuthKeyUnregistered(error)) return safeUnauthorizedSession(requestId);
    return safeServerError('Get stats error', error, requestId);
  }
}
