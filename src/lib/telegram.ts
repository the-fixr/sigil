/**
 * Telegram Bot API helper for @SigilBondBot.
 *
 * Env vars:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHANNEL_ID — numeric ID or @channel_username for announcements
 */

const TG_API = 'https://api.telegram.org';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return token;
}

function botUrl(method: string): string {
  return `${TG_API}/bot${getBotToken()}/${method}`;
}

// ── Core API methods ──────────────────────────────────────────────

interface SendMessageOpts {
  chatId: string | number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disablePreview?: boolean;
  replyTo?: number;
}

export async function sendMessage(opts: SendMessageOpts): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
    parse_mode: opts.parseMode || 'HTML',
  };
  if (opts.disablePreview) body.disable_web_page_preview = true;
  if (opts.replyTo) body.reply_to_message_id = opts.replyTo;

  const res = await fetch(botUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Telegram sendMessage error:', res.status, err);
    return false;
  }
  return true;
}

/**
 * Post to the announcements channel.
 */
export async function postToChannel(text: string): Promise<boolean> {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) {
    console.warn('TELEGRAM_CHANNEL_ID not set, skipping channel post');
    return false;
  }
  return sendMessage({ chatId: channelId, text });
}

/**
 * Register the webhook URL with Telegram.
 */
export async function setWebhook(url: string): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(botUrl('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      allowed_updates: ['message'],
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
    }),
  });
  return res.json();
}

/**
 * Get current webhook info (for debugging).
 */
export async function getWebhookInfo(): Promise<unknown> {
  const res = await fetch(botUrl('getWebhookInfo'));
  return res.json();
}

// ── Types for incoming updates ────────────────────────────────────

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}
