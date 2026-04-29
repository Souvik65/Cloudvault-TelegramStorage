import { NextResponse } from 'next/server';
import { createRequestId, safeServerError, safeUnauthorizedSession, withRequestId } from '@/lib/api-error';
import { getSessionFromRequest } from '@/lib/session';
import { getClient } from '@/lib/tg-client';
import { consumeFixedWindow, getClientIp } from '@/lib/rate-limit';

// Escape characters that have special meaning in Telegram HTML parse mode
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(req: Request) {
  const requestId = createRequestId();
  try {
    const sessionString = getSessionFromRequest(req);
    if (!sessionString) {
      return safeUnauthorizedSession(requestId);
    }

    try {
      const client = await getClient(sessionString);
      const me = await client.getMe();
      if (!me) {
        return safeUnauthorizedSession(requestId);
      }
    } catch {
      return safeUnauthorizedSession(requestId);
    }

    const ip = getClientIp(req);
    const feedbackRate = consumeFixedWindow('feedback-submit', `${ip}:${sessionString.slice(0, 24)}`, 10, 60 * 60 * 1000);
    if (!feedbackRate.allowed) {
      return NextResponse.json(withRequestId({ error: 'Too many feedback submissions. Please try again later.' }, requestId), {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
          'Retry-After': String(feedbackRate.retryAfter),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(feedbackRate.remaining),
          'X-RateLimit-Reset': String(feedbackRate.resetAt),
        },
      });
    }

    const botToken = process.env.TELEGRAM_FEEDBACK_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_FEEDBACK_CHANNEL_ID;

    if (!botToken || botToken === 'your_bot_token_here') {
      return NextResponse.json(
        { error: 'Feedback bot is not configured. Please set TELEGRAM_FEEDBACK_BOT_TOKEN.' },
        { status: 503 }
      );
    }

    if (!channelId) {
      return NextResponse.json(
        { error: 'Feedback channel is not configured. Please set TELEGRAM_FEEDBACK_CHANNEL_ID.' },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        withRequestId({ error: 'Invalid JSON body' }, requestId),
        { status: 400, headers: { 'X-Request-Id': requestId } }
      );
    }

    const { type, subject, description, userName, userHandle, userId } = body;

    const normalizedType = typeof type === 'string' ? type.trim() : '';
    const normalizedSubject = typeof subject === 'string' ? subject.trim() : '';
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';
    const normalizedUserName = typeof userName === 'string' ? userName.trim() : '';
    const normalizedUserHandle = typeof userHandle === 'string' ? userHandle.trim() : '';
    const normalizedUserId = typeof userId === 'string' || typeof userId === 'number' ? String(userId).trim() : '';

    if (!['bug', 'feedback'].includes(normalizedType)) {
      return NextResponse.json(withRequestId({ error: 'Invalid feedback type' }, requestId), { status: 400 });
    }

    if (!normalizedSubject || normalizedSubject.length > 120) {
      return NextResponse.json(withRequestId({ error: 'Subject is required and must be <= 120 characters' }, requestId), { status: 400 });
    }

    if (!normalizedDescription || normalizedDescription.length > 1500) {
      return NextResponse.json(withRequestId({ error: 'Description is required and must be <= 1500 characters' }, requestId), { status: 400 });
    }

    if (normalizedUserName.length > 120 || normalizedUserHandle.length > 120 || normalizedUserId.length > 64) {
      return NextResponse.json(withRequestId({ error: 'Invalid user metadata' }, requestId), { status: 400 });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const emoji = normalizedType === 'bug' ? '🐛' : '💬';
    const typeLabel = normalizedType === 'bug' ? 'Bug Report' : 'Feedback';
    const priorityTag = normalizedType === 'bug' ? '#bug #report' : '#feedback #suggestion';

    const message =
      `${emoji} <b>${typeLabel}</b> ${emoji}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 <b>Subject:</b>\n${escapeHtml(normalizedSubject)}\n\n` +
      `📝 <b>Description:</b>\n${escapeHtml(normalizedDescription)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Submitted By:</b>\n` +
      `┃ Name: ${escapeHtml(normalizedUserName || 'Unknown')}\n` +
      `┃ Handle: ${normalizedUserHandle ? '@' + escapeHtml(normalizedUserHandle) : 'N/A'}\n` +
      `┃ User ID: ${escapeHtml(normalizedUserId || 'N/A')}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 Date: ${dateStr}\n` +
      `⏰ Time: ${timeStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${priorityTag} #storagevault`;

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      console.error('Telegram Bot API error:', data);
      throw new Error(data.description || 'Failed to send message via bot');
    }

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: unknown) {
    return safeServerError('Feedback submission error', error, requestId);
  }
}
