import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tg-client';
import { Api } from 'telegram';

export async function POST(req: Request) {
  try {
    const sessionString = req.headers.get('x-tg-session');
    if (!sessionString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, subject, description, userName, userHandle, userId } = await req.json();

    if (!type || !subject || !description) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const client = await getClient(sessionString);

    // Find the "CloudVault Pro" channel
    const dialogs = await client.getDialogs();
    const feedbackChannel = dialogs.find((dialog) => {
      const entity = dialog.entity as any;
      return entity?.title === 'CloudVault Pro';
    });

    if (!feedbackChannel || !feedbackChannel.entity) {
      return NextResponse.json(
        { error: 'Feedback channel "CloudVault Pro" not found. Please make sure you are a member of the channel.' },
        { status: 404 }
      );
    }

    const channelEntity = feedbackChannel.entity as any;

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

    // Format the message in a clean tabular format
    const message =
      `${emoji} **${typeLabel}** ${emoji}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 **Subject:**\n${subject}\n\n` +
      `📝 **Description:**\n${description}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 **Submitted By:**\n` +
      `┃ Name: ${userName}\n` +
      `┃ Handle: @${userHandle}\n` +
      `┃ User ID: ${userId}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 Date: ${dateStr}\n` +
      `⏰ Time: ${timeStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${priorityTag} #cloudvault`;

    await client.sendMessage(channelEntity, { message, parseMode: 'md' });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
