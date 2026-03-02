import { NextResponse } from 'next/server';

// Escape characters that have special meaning in Telegram HTML parse mode
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(req: Request) {
  try {
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

    const { type, subject, description, userName, userHandle, userId } = await req.json();

    if (!type || !subject || !description) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
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

    const emoji = type === 'bug' ? '🐛' : '💬';
    const typeLabel = type === 'bug' ? 'Bug Report' : 'Feedback';
    const priorityTag = type === 'bug' ? '#bug #report' : '#feedback #suggestion';

    const message =
      `${emoji} <b>${typeLabel}</b> ${emoji}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 <b>Subject:</b>\n${escapeHtml(subject)}\n\n` +
      `📝 <b>Description:</b>\n${escapeHtml(description)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Submitted By:</b>\n` +
      `┃ Name: ${escapeHtml(userName)}\n` +
      `┃ Handle: @${escapeHtml(userHandle)}\n` +
      `┃ User ID: ${escapeHtml(String(userId))}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 Date: ${dateStr}\n` +
      `⏰ Time: ${timeStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${priorityTag} #cloudvault`;

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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
