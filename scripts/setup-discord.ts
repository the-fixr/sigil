#!/usr/bin/env npx tsx
/**
 * Setup script for Sigil Discord bot.
 *
 * Registers global slash commands and prints required env vars.
 *
 * Usage:
 *   DISCORD_BOT_TOKEN=<token> DISCORD_APPLICATION_ID=<id> npx tsx scripts/setup-discord.ts
 */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;

if (!BOT_TOKEN || !APP_ID) {
  console.error('Required: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID');
  process.exit(1);
}

const DISCORD_API = 'https://discord.com/api/v10';

const commands = [
  {
    name: 'sigil-today',
    description: 'Current billboard status — who claimed today, check-in count',
    type: 1, // CHAT_INPUT
  },
  {
    name: 'sigil-stats',
    description: 'Protocol stats — mints, claims, incentives, check-ins',
    type: 1,
  },
  {
    name: 'sigil-leaderboard',
    description: 'Top 10 check-in holders (all time)',
    type: 1,
  },
  {
    name: 'sigil-subscribe',
    description: 'Subscribe this channel to daily Sigil updates (requires Manage Channels)',
    type: 1,
  },
];

async function main() {
  console.log('Setting up Sigil Discord bot...\n');

  // 1. Get bot info
  const meRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
  const me = await meRes.json();

  if (me.id) {
    console.log(`Bot: ${me.username}#${me.discriminator}`);
    console.log(`Bot ID: ${me.id}\n`);
  } else {
    console.error('Invalid bot token:', me);
    process.exit(1);
  }

  // 2. Register global commands
  const res = await fetch(`${DISCORD_API}/applications/${APP_ID}/commands`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to register commands: ${res.status} ${err}`);
    process.exit(1);
  }

  const registered = await res.json();
  console.log(`Registered ${registered.length} slash commands:\n`);
  for (const cmd of registered) {
    console.log(`  /${cmd.name} — ${cmd.description}`);
  }

  // 3. Generate invite URL
  // Permissions: Send Messages (2048) + Use Slash Commands (2147483648)
  const permissions = 2048;
  const scopes = 'bot%20applications.commands';
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${APP_ID}&permissions=${permissions}&scope=${scopes}`;

  console.log('\n--- Invite URL ---');
  console.log(inviteUrl);

  // 4. Print env vars
  console.log('\n--- Add these to Vercel ---');
  console.log(`DISCORD_BOT_TOKEN=${BOT_TOKEN}`);
  console.log(`DISCORD_APPLICATION_ID=${APP_ID}`);
  console.log(`DISCORD_PUBLIC_KEY=<from Developer Portal General Information>`);
  console.log('\nDone.');
}

main().catch(console.error);
