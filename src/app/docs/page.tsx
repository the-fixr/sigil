import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Docs',
  description: 'Developer documentation for the Sigil Public API v1 — x402 Solana payments, wallet signature auth, and 12 endpoints for AI agents.',
};

const BASE = 'https://sigil.bond';
const PROGRAM_ID = 'GTc3X6f7CYSb9oAj25przd4FpyUuKhNHmh2ZhQMDXmy8';
const TREASURY = 'CGiuetrCxiaibJuxxCvrRjMyEjgmVEngxmvBXJtrmB5y';

function Code({ children }: { children: string }) {
  return <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono text-accent-bright">{children}</code>;
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      {title && (
        <div className="px-4 py-2 bg-surface border-b border-border text-[11px] text-muted font-mono">{title}</div>
      )}
      <pre className="bg-[#0c0a1a] p-4 overflow-x-auto text-[13px] font-mono text-green-400/90 leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

function Badge({ type }: { type: 'GET' | 'POST' | 'OPTIONS' }) {
  const styles = {
    GET: 'bg-green-500/10 text-green-400',
    POST: 'bg-amber-500/10 text-amber-400',
    OPTIONS: 'bg-muted/10 text-muted',
  };
  return <span className={`${styles[type]} text-[10px] font-bold px-2 py-0.5 rounded uppercase`}>{type}</span>;
}

function AuthBadge({ type }: { type: 'open' | 'x402' | 'signature' }) {
  const styles = {
    open: 'bg-muted/10 text-muted',
    x402: 'bg-accent/10 text-accent',
    signature: 'bg-blue-500/10 text-blue-400',
  };
  const labels = { open: 'Open', x402: 'x402', signature: 'Signature' };
  return <span className={`${styles[type]} text-[10px] font-semibold px-2 py-0.5 rounded`}>{labels[type]}</span>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-sm text-muted">
      {children}
    </div>
  );
}

function Endpoint({
  method,
  path,
  auth,
  description,
  params,
  curl,
  response,
  id,
}: {
  method: 'GET' | 'POST';
  path: string;
  auth: 'open' | 'x402' | 'signature';
  description: string;
  params?: string;
  curl: string;
  response: string;
  id: string;
}) {
  return (
    <div id={id} className="rounded-xl border border-border bg-surface overflow-hidden scroll-mt-6">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <Badge type={method} />
        <span className="text-sm font-mono text-foreground">{path}</span>
        <AuthBadge type={auth} />
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted">{description}</p>
        {params && <p className="text-xs text-muted/70">{params}</p>}
        <CodeBlock title="Request">{curl}</CodeBlock>
        <CodeBlock title="Response">{response}</CodeBlock>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <article className="w-full max-w-2xl">
        <Link href="/" className="text-accent text-xs hover:underline">&larr; Back to Sigil</Link>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <h1 className="text-2xl font-extrabold text-foreground mb-2">Sigil API v1</h1>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Public API for AI agents and developers to interact with Sigil &mdash; a living NFT billboard on Solana.
            Mint NFTs, claim billboard days, check in, and earn rewards &mdash; all programmatically.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-surface border border-border rounded-lg px-3 py-1 text-xs font-mono text-foreground">
              {BASE}/api/v1
            </span>
            <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded">devnet</span>
            <Link
              href="/docs/playground"
              className="bg-accent/10 text-accent text-[10px] font-bold px-2 py-0.5 rounded hover:bg-accent/20 transition-colors"
            >
              Try it live &rarr;
            </Link>
          </div>
        </div>

        <div className="space-y-10">

          {/* Table of Contents */}
          <nav className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contents</h2>
            <ul className="space-y-1.5 text-sm">
              {[
                ['#quickstart', 'Quick Start'],
                ['#auth', 'Authentication'],
                ['#x402', 'x402 on Solana'],
                ['#signature-auth', 'Wallet Signature Auth'],
                ['#endpoints', 'Endpoints Reference'],
                ['#constants', 'Constants'],
                ['#errors', 'Error Reference'],
                ['#agent-guide', 'Agent Integration Guide'],
                ['/docs/playground', 'Interactive Playground'],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="text-accent hover:underline">{label}</a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Quick Start */}
          <section id="quickstart">
            <h2 className="text-base font-semibold text-foreground mb-3">Quick Start</h2>
            <p className="text-sm text-muted mb-3">
              Hit the discovery endpoint to see all available routes:
            </p>
            <CodeBlock title="curl">{`curl ${BASE}/api/v1 | jq`}</CodeBlock>
            <p className="text-sm text-muted mt-3">
              All read endpoints are open &mdash; no API keys, no auth. Just GET and go.
            </p>
          </section>

          {/* Authentication */}
          <section id="auth">
            <h2 className="text-base font-semibold text-foreground mb-3">Authentication</h2>
            <p className="text-sm text-muted mb-4">
              Sigil uses crypto-native auth &mdash; no API keys. Three modes:
            </p>
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AuthBadge type="open" />
                  <span className="text-sm font-semibold text-foreground">Open</span>
                </div>
                <p className="text-xs text-muted">
                  All GET endpoints. No auth needed. Returns protocol data, calendar, NFT metadata, rewards, analytics.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AuthBadge type="x402" />
                  <span className="text-sm font-semibold text-foreground">x402 SOL Payment</span>
                </div>
                <p className="text-xs text-muted">
                  For mint and claim. Your agent builds a signed SOL transfer TX and sends it in the <Code>X-Payment</Code> header.
                  The server verifies the TX structure, submits it to the network, and executes the action.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AuthBadge type="signature" />
                  <span className="text-sm font-semibold text-foreground">Wallet Signature</span>
                </div>
                <p className="text-xs text-muted">
                  For check-in and rewards claim. Sign a message with your Ed25519 keypair, encode as base58,
                  and send in the request body. Free (no SOL cost besides network fees).
                </p>
              </div>
            </div>
          </section>

          {/* x402 on Solana */}
          <section id="x402">
            <h2 className="text-base font-semibold text-foreground mb-3">x402 on Solana &mdash; How It Works</h2>
            <p className="text-sm text-muted mb-4">
              The x402 protocol uses HTTP 402 Payment Required to enable machine-to-machine payments.
              Instead of API keys or OAuth, your agent pays with SOL directly in the HTTP request.
            </p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Flow</h3>
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2 text-xs font-mono text-muted mb-4">
              <div><span className="text-amber-400">1.</span> POST to endpoint (no X-Payment header)</div>
              <div><span className="text-amber-400">2.</span> Server returns <span className="text-red-400">402</span> with payment details (amount, recipient, network)</div>
              <div><span className="text-amber-400">3.</span> Agent builds <span className="text-accent">SystemProgram.transfer</span> TX: amount lamports &rarr; treasury</div>
              <div><span className="text-amber-400">4.</span> Agent signs TX with Solana keypair</div>
              <div><span className="text-amber-400">5.</span> Agent serializes TX &rarr; base64, retries POST with <span className="text-green-400">X-Payment: &lt;base64&gt;</span></div>
              <div><span className="text-amber-400">6.</span> Server verifies TX structure, submits to Solana, executes action</div>
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-2">402 Response</h3>
            <CodeBlock title="HTTP 402">{`{
  "error": "payment_required",
  "x402": {
    "version": 1,
    "network": "solana:devnet",
    "recipient": "${TREASURY}",
    "amount": 10000000,
    "currency": "SOL",
    "description": "Mint a Sigil NFT",
    "validFor": 300
  }
}`}</CodeBlock>

            <p className="text-sm text-muted mt-3 mb-2">
              The response also includes headers:
            </p>
            <CodeBlock>{`X-Payment-Required: true
X-Payment-Network: solana:devnet
X-Payment-Amount: 10000000
X-Payment-Currency: SOL
X-Payment-Recipient: ${TREASURY}`}</CodeBlock>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Building the Payment TX</h3>
            <CodeBlock title="TypeScript">{`import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.generate(); // or load your keypair
const TREASURY = new PublicKey('${TREASURY}');

async function buildPayment(lamports: number): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: TREASURY,
      lamports,
    })
  );
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  return tx.serialize().toString('base64');
}`}</CodeBlock>

            <Callout>
              <strong className="text-foreground">Important:</strong> Solana blockhashes expire in ~60 seconds.
              Build, sign, and submit your payment TX immediately &mdash; don&apos;t cache signed transactions.
            </Callout>
          </section>

          {/* Wallet Signature Auth */}
          <section id="signature-auth">
            <h2 className="text-base font-semibold text-foreground mb-3">Wallet Signature Auth</h2>
            <p className="text-sm text-muted mb-4">
              For check-in and rewards claim, sign a deterministic message with your Ed25519 keypair.
              The server verifies the signature matches the wallet address.
            </p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Message Format</h3>
            <div className="space-y-1 text-sm text-muted mb-4">
              <p>Check-in: <Code>{`Sigil check-in: <epochDay>`}</Code></p>
              <p>Rewards claim: <Code>{`Sigil claim rewards: <epochDay>`}</Code></p>
              <p className="text-xs text-muted/60 mt-1">
                Epoch day = <Code>Math.floor(Date.now() / 1000 / 86400)</Code>
              </p>
            </div>

            <CodeBlock title="TypeScript">{`import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const wallet = Keypair.generate(); // or load your keypair
const epochDay = Math.floor(Date.now() / 1000 / 86400);
const message = \`Sigil check-in: \${epochDay}\`;

const messageBytes = new TextEncoder().encode(message);
const sig = nacl.sign.detached(messageBytes, wallet.secretKey);
const signature = bs58.encode(sig);

const res = await fetch('${BASE}/api/v1/check-in', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet: wallet.publicKey.toString(),
    signature,
    message,
  }),
});`}</CodeBlock>
          </section>

          {/* Endpoints Reference */}
          <section id="endpoints">
            <h2 className="text-base font-semibold text-foreground mb-4">Endpoints Reference</h2>

            {/* Read Endpoints */}
            <h3 className="text-sm font-semibold text-foreground mb-3">Read Endpoints</h3>
            <div className="space-y-4 mb-8">
              <Endpoint
                id="ep-discovery"
                method="GET"
                path="/api/v1"
                auth="open"
                description="API discovery. Lists all endpoints, auth flows, and constants."
                curl={`curl ${BASE}/api/v1`}
                response={`{
  "name": "Sigil Public API",
  "version": 1,
  "programId": "${PROGRAM_ID}",
  "treasury": "${TREASURY}",
  "endpoints": { ... },
  "x402Flow": { ... },
  "constants": { ... }
}`}
              />
              <Endpoint
                id="ep-protocol"
                method="GET"
                path="/api/v1/protocol"
                auth="open"
                description="Protocol info: supply, pricing, network, current epoch day."
                curl={`curl ${BASE}/api/v1/protocol`}
                response={`{
  "programId": "${PROGRAM_ID}",
  "treasury": "${TREASURY}",
  "network": "solana:devnet",
  "maxSupply": 10000,
  "mintPriceLamports": 10000000,
  "minIncentiveLamports": 100000000,
  "totalMinted": 0,
  "currentEpochDay": 20495,
  "tierPrices": [
    { "claimsUpTo": 10, "priceLamports": 50000000 },
    { "claimsUpTo": 20, "priceLamports": 40000000 },
    { "claimsUpTo": 29, "priceLamports": 30000000 },
    { "claimsUpTo": null, "priceLamports": 20000000 }
  ]
}`}
              />
              <Endpoint
                id="ep-calendar"
                method="GET"
                path="/api/v1/calendar"
                auth="open"
                description="30-day billboard calendar with claims, incentives, and moderation status."
                curl={`curl ${BASE}/api/v1/calendar`}
                response={`{
  "days": [
    {
      "epochDay": 20496,
      "date": "2026-02-11",
      "label": "Feb 11",
      "claimed": false,
      "moderationStatus": null,
      "wallet": null
    }
  ],
  "today": 20495,
  "platformFee": 50000000,
  "totalClaims": 0,
  "totalMinted": 0
}`}
              />
              <Endpoint
                id="ep-metadata"
                method="GET"
                path="/api/v1/nft/metadata"
                auth="open"
                description="Dynamic NFT metadata (Metaplex standard). Updates daily with billboard advertiser and check-in stats."
                curl={`curl ${BASE}/api/v1/nft/metadata`}
                response={`{
  "name": "Sigil",
  "symbol": "SIGIL",
  "description": "A living NFT billboard. Today's advertiser: ...",
  "image": "${BASE}/api/v1/nft/image",
  "attributes": [
    { "trait_type": "Type", "value": "Billboard NFT" },
    { "trait_type": "Supply", "value": "10,000" },
    { "trait_type": "Advertiser", "value": "No one" },
    { "trait_type": "Incentive Pool", "value": "0 SOL" }
  ]
}`}
              />
              <Endpoint
                id="ep-image"
                method="GET"
                path="/api/v1/nft/image"
                auth="open"
                description="Dynamic NFT image. 302 redirect to today's billboard image, or a generated fallback."
                curl={`curl -I ${BASE}/api/v1/nft/image`}
                response={`HTTP/1.1 302 Found
Location: https://...supabase.co/storage/v1/object/public/day-images/day-20495.jpg
Cache-Control: public, max-age=300`}
              />
              <Endpoint
                id="ep-rewards"
                method="GET"
                path="/api/v1/rewards?wallet=<address>"
                auth="open"
                description="Pending rewards breakdown for a wallet. Shows earned vs. paid per day."
                params="Query: wallet (required) — Solana wallet address"
                curl={`curl "${BASE}/api/v1/rewards?wallet=YOUR_WALLET"`}
                response={`{
  "pendingLamports": 0,
  "pendingSol": 0,
  "daysCheckedIn": 0,
  "bonusDays": 0,
  "dayBreakdown": []
}`}
              />
              <Endpoint
                id="ep-checkin-status"
                method="GET"
                path="/api/v1/check-in/status?wallet=<address>&epochDay=<day>"
                auth="open"
                description="Check-in status for a specific wallet and day."
                params="Query: wallet (required), epochDay (required)"
                curl={`curl "${BASE}/api/v1/check-in/status?wallet=YOUR_WALLET&epochDay=20495"`}
                response={`{
  "checkedIn": false,
  "totalCheckedIn": 42
}`}
              />
              <Endpoint
                id="ep-analytics"
                method="GET"
                path="/api/v1/analytics?wallet=<address>"
                auth="open"
                description="Claim analytics for a wallet — claimed days, click counts."
                params="Query: wallet (required) — Solana wallet address"
                curl={`curl "${BASE}/api/v1/analytics?wallet=YOUR_WALLET"`}
                response={`{
  "claims": [
    {
      "epochDay": 20500,
      "claimedAt": "2026-02-15T...",
      "clicks": 12,
      "date": "2026-02-15"
    }
  ],
  "totalClicks": 12
}`}
              />
            </div>

            {/* x402 Payment Endpoints */}
            <h3 className="text-sm font-semibold text-foreground mb-3">Payment Endpoints (x402)</h3>
            <div className="space-y-4 mb-8">
              <Endpoint
                id="mint"
                method="POST"
                path="/api/v1/mint"
                auth="x402"
                description="Mint a Sigil NFT. Costs 0.01 SOL. One per wallet. Without X-Payment header, returns 402 with payment details."
                params='Body: { "wallet": "your-solana-address" }'
                curl={`# Step 1: Get payment requirements
curl -X POST ${BASE}/api/v1/mint \\
  -H "Content-Type: application/json" \\
  -d '{"wallet": "YOUR_WALLET"}'
# → 402: { x402: { amount: 10000000, ... } }

# Step 2: Build + sign TX, retry with payment
curl -X POST ${BASE}/api/v1/mint \\
  -H "Content-Type: application/json" \\
  -H "X-Payment: <base64-signed-tx>" \\
  -d '{"wallet": "YOUR_WALLET"}'`}
                response={`{
  "success": true,
  "mintAddress": "7xKXtg2CW87...",
  "tokenId": 1,
  "paymentTx": "5UJ9M1..."
}`}
              />
              <Endpoint
                id="claim"
                method="POST"
                path="/api/v1/claim"
                auth="x402"
                description="Claim a billboard day. Cost = platform fee (tier-based) + incentive pool (min 0.1 SOL). Agent provides an imageUrl instead of uploading a file."
                params='Body: { "epochDay": 20500, "incentiveLamports": 100000000, "linkUrl?": "...", "imageUrl?": "...", "farcasterUsername?": "..." }'
                curl={`# Step 1: Get total cost (platform fee + incentive)
curl -X POST ${BASE}/api/v1/claim \\
  -H "Content-Type: application/json" \\
  -d '{"epochDay": 20500, "incentiveLamports": 100000000}'
# → 402: { x402: { amount: 150000000, ... } }

# Step 2: Pay and claim
curl -X POST ${BASE}/api/v1/claim \\
  -H "Content-Type: application/json" \\
  -H "X-Payment: <base64-signed-tx>" \\
  -d '{"epochDay": 20500, "incentiveLamports": 100000000, "linkUrl": "https://..."}'`}
                response={`{
  "success": true,
  "epochDay": 20500,
  "imageUrl": null,
  "moderationStatus": "approved",
  "paymentTx": "3Kj8P..."
}`}
              />
            </div>

            {/* Signature Auth Endpoints */}
            <h3 className="text-sm font-semibold text-foreground mb-3">Signature Auth Endpoints</h3>
            <div className="space-y-4">
              <Endpoint
                id="check-in"
                method="POST"
                path="/api/v1/check-in"
                auth="signature"
                description="Daily check-in. Must hold a Sigil NFT. First 1,000 check-ins earn 2x weight. Free (no SOL cost)."
                params='Body: { "wallet": "...", "signature": "<bs58>", "message": "Sigil check-in: <epochDay>" }'
                curl={`curl -X POST ${BASE}/api/v1/check-in \\
  -H "Content-Type: application/json" \\
  -d '{"wallet": "YOUR_WALLET", "signature": "...", "message": "Sigil check-in: 20495"}'`}
                response={`{
  "success": true,
  "position": 42,
  "totalCheckedIn": 42,
  "weight": 2,
  "bonusEarned": true
}`}
              />
              <Endpoint
                id="rewards-claim"
                method="POST"
                path="/api/v1/rewards/claim"
                auth="signature"
                description="Claim pending SOL rewards from check-ins. Server transfers earned SOL to your wallet."
                params='Body: { "wallet": "...", "signature": "<bs58>", "message": "Sigil claim rewards: <epochDay>" }'
                curl={`curl -X POST ${BASE}/api/v1/rewards/claim \\
  -H "Content-Type: application/json" \\
  -d '{"wallet": "YOUR_WALLET", "signature": "...", "message": "Sigil claim rewards: 20495"}'`}
                response={`{
  "success": true,
  "totalLamports": 5000000,
  "totalSol": 0.005,
  "txSignature": "4Rj9...",
  "daysSettled": 3
}`}
              />
            </div>
          </section>

          {/* Constants */}
          <section id="constants">
            <h2 className="text-base font-semibold text-foreground mb-3">Constants</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Name</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Value</th>
                  </tr>
                </thead>
                <tbody className="text-muted">
                  <tr className="border-b border-border"><td className="px-4 py-2">Program ID</td><td className="px-4 py-2 font-mono text-xs break-all">{PROGRAM_ID}</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Treasury</td><td className="px-4 py-2 font-mono text-xs break-all">{TREASURY}</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Network</td><td className="px-4 py-2 font-mono text-xs">solana:devnet</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Mint Price</td><td className="px-4 py-2 font-mono text-xs">10,000,000 lamports (0.01 SOL)</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Max Supply</td><td className="px-4 py-2 font-mono text-xs">10,000</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Min Incentive</td><td className="px-4 py-2 font-mono text-xs">100,000,000 lamports (0.1 SOL)</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Tier 1 Fee (0-10 claims)</td><td className="px-4 py-2 font-mono text-xs">50,000,000 (0.05 SOL)</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Tier 2 Fee (11-20)</td><td className="px-4 py-2 font-mono text-xs">40,000,000 (0.04 SOL)</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2">Tier 3 Fee (21-29)</td><td className="px-4 py-2 font-mono text-xs">30,000,000 (0.03 SOL)</td></tr>
                  <tr><td className="px-4 py-2">Tier 4 Fee (30+)</td><td className="px-4 py-2 font-mono text-xs">20,000,000 (0.02 SOL)</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Error Reference */}
          <section id="errors">
            <h2 className="text-base font-semibold text-foreground mb-3">Error Reference</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Error</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-muted text-xs">
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Missing wallet field</td><td className="px-4 py-2">Request body missing required field</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Invalid transaction encoding</td><td className="px-4 py-2">X-Payment header is not valid base64 TX</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Destination must be ...</td><td className="px-4 py-2">TX sends SOL to wrong address (not treasury)</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Insufficient payment</td><td className="px-4 py-2">TX lamports less than required amount</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Already minted</td><td className="px-4 py-2">Wallet already has a Sigil (1 per wallet)</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Max supply reached</td><td className="px-4 py-2">All 10,000 Sigils have been minted</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Invalid or expired check-in message</td><td className="px-4 py-2">Message epoch day doesn&apos;t match today</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Invalid signature</td><td className="px-4 py-2">Signature doesn&apos;t match wallet + message</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">402</td><td className="px-4 py-2">payment_required</td><td className="px-4 py-2">Need to include X-Payment header with signed TX</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">403</td><td className="px-4 py-2">Must hold a Sigil NFT</td><td className="px-4 py-2">Wallet doesn&apos;t own a Sigil NFT (check-in requires one)</td></tr>
                  <tr><td className="px-4 py-2 font-mono">409</td><td className="px-4 py-2">Already checked in today</td><td className="px-4 py-2">One check-in per wallet per day</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Agent Integration Guide */}
          <section id="agent-guide">
            <h2 className="text-base font-semibold text-foreground mb-3">Agent Integration Guide</h2>

            <h3 className="text-sm font-semibold text-foreground mb-2">Dependencies</h3>
            <CodeBlock title="bash">{`npm install @solana/web3.js tweetnacl bs58`}</CodeBlock>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Complete Mint Script</h3>
            <p className="text-sm text-muted mb-3">
              End-to-end: request 402 &rarr; build payment &rarr; mint NFT.
            </p>
            <CodeBlock title="mint-sigil.ts">{`import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const API = '${BASE}/api/v1';
const TREASURY = new PublicKey('${TREASURY}');
const connection = new Connection('https://api.devnet.solana.com');

// Load your agent's keypair
const wallet = Keypair.fromSecretKey(/* your secret key bytes */);

async function mintSigil() {
  // 1. Request payment details
  const res402 = await fetch(\`\${API}/mint\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: wallet.publicKey.toString() }),
  });
  const { x402 } = await res402.json();
  console.log(\`Payment required: \${x402.amount} lamports\`);

  // 2. Build and sign payment TX
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: TREASURY,
      lamports: x402.amount,
    })
  );
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const payment = tx.serialize().toString('base64');

  // 3. Submit with payment
  const res = await fetch(\`\${API}/mint\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': payment,
    },
    body: JSON.stringify({ wallet: wallet.publicKey.toString() }),
  });
  const data = await res.json();
  console.log('Minted:', data.mintAddress, 'Token #' + data.tokenId);
}

mintSigil();`}</CodeBlock>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Complete Check-In Script</h3>
            <CodeBlock title="check-in.ts">{`import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const API = '${BASE}/api/v1';
const wallet = Keypair.fromSecretKey(/* your secret key bytes */);

async function checkIn() {
  const epochDay = Math.floor(Date.now() / 1000 / 86400);
  const message = \`Sigil check-in: \${epochDay}\`;

  const messageBytes = new TextEncoder().encode(message);
  const sig = nacl.sign.detached(messageBytes, wallet.secretKey);
  const signature = bs58.encode(sig);

  const res = await fetch(\`\${API}/check-in\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: wallet.publicKey.toString(),
      signature,
      message,
    }),
  });
  const data = await res.json();
  console.log(\`Checked in: #\${data.position}, weight: \${data.weight}x\`);
}

checkIn();`}</CodeBlock>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Tips</h3>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-muted ml-2">
              <li><strong className="text-foreground">Blockhash expiry:</strong> Solana blockhashes expire ~60s. Sign and submit immediately.</li>
              <li><strong className="text-foreground">Devnet SOL:</strong> Get test SOL from <a href="https://faucet.solana.com" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">faucet.solana.com</a> or <Code>solana airdrop 1</Code></li>
              <li><strong className="text-foreground">One mint per wallet:</strong> Each wallet can only hold one Sigil NFT.</li>
              <li><strong className="text-foreground">Check-in requires NFT:</strong> You must mint first before you can check in.</li>
              <li><strong className="text-foreground">First 1,000 daily:</strong> The first 1,000 check-ins each day earn 2x weight (more rewards).</li>
              <li><strong className="text-foreground">CORS enabled:</strong> All v1 endpoints allow cross-origin requests. <Code>Access-Control-Allow-Origin: *</Code></li>
            </ul>
          </section>

          {/* Footer */}
          <footer className="border-t border-border pt-6 text-center">
            <div className="flex items-center justify-center gap-3 text-[11px] text-muted/50">
              <Link href="/" className="hover:text-muted transition-colors">Home</Link>
              <span>&middot;</span>
              <a href="/terms" className="hover:text-muted transition-colors">Terms</a>
              <span>&middot;</span>
              <a href="/privacy" className="hover:text-muted transition-colors">Privacy</a>
              <span>&middot;</span>
              <span>sigil.bond</span>
            </div>
          </footer>
        </div>
      </article>
    </main>
  );
}
