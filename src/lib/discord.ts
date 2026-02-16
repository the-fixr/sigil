/**
 * Discord Bot API helper for Sigil.
 *
 * Uses HTTP Interactions (no WebSocket gateway) — serverless-friendly.
 *
 * Env vars:
 *   DISCORD_BOT_TOKEN    — Bot token from Discord Developer Portal
 *   DISCORD_PUBLIC_KEY   — Application public key for signature verification
 *   DISCORD_APPLICATION_ID — Application ID for registering commands
 */

import nacl from 'tweetnacl';

const DISCORD_API = 'https://discord.com/api/v10';

// ── Signature Verification ─────────────────────────────────────────

/**
 * Verify Discord interaction signature (Ed25519).
 * Returns false if verification fails.
 */
export function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return false;

  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKey, 'hex')
    );
  } catch {
    return false;
  }
}

// ── Discord API Helpers ────────────────────────────────────────────

async function discordFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN not set');

  return fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
      ...(options.headers || {}),
    },
  });
}

/**
 * Send a message to a Discord channel.
 */
export async function sendChannelMessage(
  channelId: string,
  content: string
): Promise<boolean> {
  try {
    const res = await discordFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      console.error('Discord sendChannelMessage error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Discord sendChannelMessage failed:', error);
    return false;
  }
}

/**
 * Post to all subscribed Discord channels.
 * Reads guild+channel pairs from Supabase `discord_subscriptions` table.
 */
export async function postToDiscordSubscribers(text: string): Promise<boolean> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.warn('DISCORD_BOT_TOKEN not set, skipping Discord');
    return false;
  }

  try {
    // Dynamic import to avoid circular deps
    const { supabase } = await import('@/lib/supabase');

    const { data: subs } = await supabase
      .from('discord_subscriptions')
      .select('channel_id');

    if (!subs || subs.length === 0) return false;

    const results = await Promise.all(
      subs.map((s: { channel_id: string }) => sendChannelMessage(s.channel_id, text))
    );

    return results.some(Boolean);
  } catch (error) {
    console.error('Discord broadcast error:', error);
    return false;
  }
}

// ── Interaction Response Types ─────────────────────────────────────

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;
