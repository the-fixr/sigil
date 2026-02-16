/**
 * Bluesky (AT Protocol) posting helper for Sigil.
 *
 * Env vars:
 *   BLUESKY_HANDLE       — e.g. sigilbond.bsky.social
 *   BLUESKY_APP_PASSWORD  — app password from bsky.app settings
 */

const BSKY_API = 'https://bsky.social/xrpc';

interface BskySession {
  did: string;
  accessJwt: string;
}

let cachedSession: BskySession | null = null;
let sessionExpiry = 0;

async function getSession(): Promise<BskySession> {
  // Reuse session for ~30 minutes
  if (cachedSession && Date.now() < sessionExpiry) {
    return cachedSession;
  }

  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) throw new Error('BLUESKY_HANDLE or BLUESKY_APP_PASSWORD not set');

  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bluesky auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedSession = { did: data.did, accessJwt: data.accessJwt };
  sessionExpiry = Date.now() + 30 * 60 * 1000;
  return cachedSession;
}

/**
 * Parse text for URLs and create facets (rich text links).
 */
function detectFacets(text: string): { index: { byteStart: number; byteEnd: number }; features: { $type: string; uri: string }[] }[] {
  const facets: { index: { byteStart: number; byteEnd: number }; features: { $type: string; uri: string }[] }[] = [];
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const encoder = new TextEncoder();

  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const beforeBytes = encoder.encode(text.slice(0, match.index)).length;
    const matchBytes = encoder.encode(match[0]).length;
    facets.push({
      index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
    });
  }

  return facets;
}

/**
 * Post to Bluesky.
 */
export async function postToBluesky(text: string): Promise<boolean> {
  if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
    console.warn('Bluesky credentials not set, skipping');
    return false;
  }

  try {
    const session = await getSession();
    const facets = detectFacets(text);

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
    };
    if (facets.length > 0) record.facets = facets;

    const res = await fetch(`${BSKY_API}/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    if (!res.ok) {
      // Session might be expired, clear cache
      cachedSession = null;
      sessionExpiry = 0;
      const err = await res.text();
      console.error('Bluesky post error:', res.status, err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Bluesky post failed:', error);
    cachedSession = null;
    sessionExpiry = 0;
    return false;
  }
}
