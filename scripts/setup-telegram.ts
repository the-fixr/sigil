#!/usr/bin/env npx tsx
/**
 * Setup script for the Sigil Telegram bot.
 *
 * Steps:
 *   1. Create a bot via @BotFather on Telegram → get the bot token
 *   2. Create a public channel (e.g. @sigilbond) → add the bot as admin
 *   3. Run this script to register the webhook
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=<token> npx tsx scripts/setup-telegram.ts
 *
 * Optional:
 *   TELEGRAM_WEBHOOK_SECRET=<secret>  — secret token for webhook verification
 *   WEBHOOK_URL=<url>                 — override webhook URL (default: https://sigil.bond/api/webhook/telegram)
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  console.error('Get one from @BotFather on Telegram');
  process.exit(1);
}

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://sigil.bond/api/webhook/telegram';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function main() {
  console.log('Setting up Sigil Telegram bot...\n');

  // 1. Get bot info
  const meRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
  const me = await meRes.json();

  if (!me.ok) {
    console.error('Invalid bot token:', me.description);
    process.exit(1);
  }

  console.log(`Bot: @${me.result.username} (${me.result.first_name})`);
  console.log(`Bot ID: ${me.result.id}\n`);

  // 2. Set webhook
  const body: Record<string, unknown> = {
    url: WEBHOOK_URL,
    allowed_updates: ['message'],
  };
  if (SECRET) body.secret_token = SECRET;

  const whRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const wh = await whRes.json();

  if (wh.ok) {
    console.log(`Webhook set: ${WEBHOOK_URL}`);
    if (SECRET) console.log('Secret token: configured');
  } else {
    console.error('Failed to set webhook:', wh.description);
    process.exit(1);
  }

  // 3. Set bot commands
  const commands = [
    { command: 'today', description: 'Current billboard status' },
    { command: 'mint', description: 'How to mint a Sigil' },
    { command: 'leaderboard', description: 'Top check-in holders' },
    { command: 'stats', description: 'Protocol numbers' },
    { command: 'help', description: 'Bot commands' },
  ];

  const cmdRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  const cmd = await cmdRes.json();

  if (cmd.ok) {
    console.log('Bot commands registered:\n');
    for (const c of commands) {
      console.log(`  /${c.command} — ${c.description}`);
    }
  }

  // 4. Print env vars needed
  console.log('\n--- Add these to Vercel ---');
  console.log(`TELEGRAM_BOT_TOKEN=${BOT_TOKEN}`);
  if (SECRET) console.log(`TELEGRAM_WEBHOOK_SECRET=${SECRET}`);
  console.log('TELEGRAM_CHANNEL_ID=@your_channel_username_or_numeric_id');
  console.log('\nDone.');
}

main().catch(console.error);
