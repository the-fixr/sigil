'use client';

import { useState, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import dynamic from 'next/dynamic';
import bs58 from 'bs58';
import Link from 'next/link';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false }
);

// ─── Constants ────────────────────────────────────────────────────

function getCurrentEpochDay() {
  return Math.floor(Date.now() / 1000 / 86400);
}

// ─── Endpoint Config ──────────────────────────────────────────────

interface Param {
  name: string;
  type: 'query' | 'body';
  required: boolean;
  default?: string;
  placeholder: string;
}

interface EndpointConfig {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  auth: 'open' | 'x402' | 'signature';
  description: string;
  params: Param[];
  paymentAmount?: number;
  signatureMessage?: string;
}

const ENDPOINTS: EndpointConfig[] = [
  // Discovery
  {
    id: 'discovery',
    method: 'GET',
    path: '/api/v1',
    auth: 'open',
    description: 'API discovery — all endpoints, auth flows, constants',
    params: [],
  },
  // Read
  {
    id: 'protocol',
    method: 'GET',
    path: '/api/v1/protocol',
    auth: 'open',
    description: 'Protocol info: supply, tiers, network',
    params: [],
  },
  {
    id: 'calendar',
    method: 'GET',
    path: '/api/v1/calendar',
    auth: 'open',
    description: '30-day billboard calendar with claims',
    params: [],
  },
  {
    id: 'metadata',
    method: 'GET',
    path: '/api/v1/nft/metadata',
    auth: 'open',
    description: 'Dynamic NFT metadata (Metaplex standard)',
    params: [
      { name: 'tokenId', type: 'query', required: false, placeholder: '1', default: '' },
    ],
  },
  {
    id: 'image',
    method: 'GET',
    path: '/api/v1/nft/image',
    auth: 'open',
    description: 'Dynamic NFT image (redirects to image URL)',
    params: [
      { name: 'tokenId', type: 'query', required: false, placeholder: '1', default: '' },
    ],
  },
  {
    id: 'rewards',
    method: 'GET',
    path: '/api/v1/rewards',
    auth: 'open',
    description: 'Pending rewards for a wallet',
    params: [
      { name: 'wallet', type: 'query', required: true, placeholder: 'Your wallet address' },
    ],
  },
  {
    id: 'check-in-status',
    method: 'GET',
    path: '/api/v1/check-in/status',
    auth: 'open',
    description: 'Check-in status for a wallet + day',
    params: [
      { name: 'wallet', type: 'query', required: true, placeholder: 'Your wallet address' },
      { name: 'epochDay', type: 'query', required: true, placeholder: String(getCurrentEpochDay()) },
    ],
  },
  {
    id: 'analytics',
    method: 'GET',
    path: '/api/v1/analytics',
    auth: 'open',
    description: 'Claim analytics for a wallet',
    params: [
      { name: 'wallet', type: 'query', required: true, placeholder: 'Your wallet address' },
    ],
  },
  // x402 Payment
  {
    id: 'mint',
    method: 'POST',
    path: '/api/v1/mint',
    auth: 'x402',
    description: 'Mint a Sigil NFT (0.01 SOL)',
    paymentAmount: 10_000_000,
    params: [
      { name: 'wallet', type: 'body', required: true, placeholder: 'Recipient wallet address' },
    ],
  },
  {
    id: 'claim',
    method: 'POST',
    path: '/api/v1/claim',
    auth: 'x402',
    description: 'Claim a billboard day (0.1+ SOL incentive)',
    paymentAmount: 100_000_000,
    params: [
      { name: 'epochDay', type: 'body', required: true, placeholder: String(getCurrentEpochDay() + 1), default: String(getCurrentEpochDay() + 1) },
      { name: 'incentiveLamports', type: 'body', required: true, placeholder: '100000000', default: '100000000' },
      { name: 'imageUrl', type: 'body', required: false, placeholder: 'https://example.com/billboard.png' },
      { name: 'linkUrl', type: 'body', required: false, placeholder: 'https://example.com' },
    ],
  },
  // Wallet Signature
  {
    id: 'check-in',
    method: 'POST',
    path: '/api/v1/check-in',
    auth: 'signature',
    description: 'Daily check-in (requires NFT holder)',
    signatureMessage: `Sigil check-in: ${getCurrentEpochDay()}`,
    params: [],
  },
  {
    id: 'rewards-claim',
    method: 'POST',
    path: '/api/v1/rewards/claim',
    auth: 'signature',
    description: 'Claim pending SOL rewards',
    signatureMessage: `Claim rewards: ${getCurrentEpochDay()}`,
    params: [],
  },
];

const GROUPS = [
  { label: 'Discovery', ids: ['discovery'] },
  { label: 'Read', ids: ['protocol', 'calendar', 'metadata', 'image', 'rewards', 'check-in-status', 'analytics'] },
  { label: 'Payment (x402)', ids: ['mint', 'claim'] },
  { label: 'Signature', ids: ['check-in', 'rewards-claim'] },
];

// ─── Sub-Components ───────────────────────────────────────────────

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  const cls =
    method === 'GET'
      ? 'bg-green-500/10 text-green-400'
      : 'bg-amber-500/10 text-amber-400';
  return (
    <span className={`${cls} text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono`}>
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: 'open' | 'x402' | 'signature' }) {
  const map = {
    open: 'bg-muted/10 text-muted',
    x402: 'bg-accent/10 text-accent',
    signature: 'bg-blue-500/10 text-blue-400',
  };
  const labels = { open: 'Open', x402: 'x402', signature: 'Signature' };
  return (
    <span className={`${map[auth]} text-[10px] font-semibold px-1.5 py-0.5 rounded`}>
      {labels[auth]}
    </span>
  );
}

function StatusBadge({ status }: { status: number }) {
  let cls = 'bg-muted/10 text-muted';
  if (status >= 200 && status < 300) cls = 'bg-green-500/10 text-green-400';
  else if (status === 402) cls = 'bg-accent/10 text-accent';
  else if (status >= 400 && status < 500) cls = 'bg-amber-500/10 text-amber-400';
  else if (status >= 500) cls = 'bg-red-500/10 text-red-400';
  return (
    <span className={`${cls} text-xs font-bold px-2 py-0.5 rounded font-mono`}>
      {status}
    </span>
  );
}

function JsonViewer({ data }: { data: unknown }) {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <pre className="bg-[#0c0a1a] rounded-xl p-4 overflow-x-auto text-[13px] font-mono text-green-400/90 max-h-[400px] overflow-y-auto">
      {json}
    </pre>
  );
}

function X402Stepper({ step }: { step: 'idle' | 'got402' | 'signing' | 'sent' }) {
  const steps = [
    { key: 'got402', label: '1. Get 402' },
    { key: 'signing', label: '2. Sign TX' },
    { key: 'sent', label: '3. Submit' },
  ];
  const order = ['idle', 'got402', 'signing', 'sent'];
  const currentIdx = order.indexOf(step);

  return (
    <div className="flex items-center gap-2 mb-3">
      {steps.map((s, i) => {
        const stepIdx = order.indexOf(s.key);
        const active = currentIdx >= stepIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-6 h-px ${active ? 'bg-accent' : 'bg-border'}`} />
            )}
            <span
              className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                active
                  ? 'bg-accent/10 text-accent'
                  : 'bg-surface text-muted'
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Playground ──────────────────────────────────────────────

export default function Playground() {
  const { publicKey, signMessage, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [selectedId, setSelectedId] = useState('discovery');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<{
    status: number;
    body: unknown;
    time: number;
    headers?: Record<string, string>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [x402State, setX402State] = useState<'idle' | 'got402' | 'signing' | 'sent'>('idle');
  const [x402Data, setX402Data] = useState<{ amount: number; recipient: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const endpoint = useMemo(
    () => ENDPOINTS.find((e) => e.id === selectedId)!,
    [selectedId]
  );

  const selectEndpoint = useCallback(
    (id: string) => {
      setSelectedId(id);
      setResponse(null);
      setX402State('idle');
      setX402Data(null);
      setMobileOpen(false);

      // Pre-fill defaults
      const ep = ENDPOINTS.find((e) => e.id === id)!;
      const defaults: Record<string, string> = {};
      for (const p of ep.params) {
        if (p.default !== undefined) defaults[p.name] = p.default;
      }
      // Auto-fill wallet if connected
      if (publicKey) {
        const walletParam = ep.params.find((p) => p.name === 'wallet');
        if (walletParam) defaults.wallet = publicKey.toString();
      }
      setParamValues(defaults);
    },
    [publicKey]
  );

  // ─── Open / GET Request ───────────────────────────────────────

  async function sendOpenRequest() {
    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      let url = endpoint.path;
      const queryParams = endpoint.params.filter((p) => p.type === 'query');
      if (queryParams.length > 0) {
        const qs = new URLSearchParams();
        for (const p of queryParams) {
          const val = paramValues[p.name];
          if (val) qs.set(p.name, val);
        }
        const qsStr = qs.toString();
        if (qsStr) url += `?${qsStr}`;
      }

      const res = await fetch(url, {
        redirect: endpoint.id === 'image' ? 'manual' : 'follow',
      });
      const time = Math.round(performance.now() - start);

      let body: unknown;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        body = await res.json();
      } else {
        body = await res.text();
      }

      // Capture redirect location for image endpoint
      if (res.status === 302 || res.status === 307) {
        body = {
          redirect: true,
          status: res.status,
          location: res.headers.get('location'),
        };
      }

      setResponse({ status: res.status, body, time });
    } catch (err) {
      setResponse({
        status: 0,
        body: { error: (err as Error).message },
        time: Math.round(performance.now() - start),
      });
    } finally {
      setLoading(false);
    }
  }

  // ─── x402 Flow ────────────────────────────────────────────────

  async function sendX402Initial() {
    setLoading(true);
    setResponse(null);
    setX402State('idle');
    const start = performance.now();

    try {
      // Build body from params
      const bodyObj: Record<string, unknown> = {};
      for (const p of endpoint.params.filter((pr) => pr.type === 'body')) {
        const val = paramValues[p.name];
        if (val) {
          // Convert numeric fields
          if (p.name === 'epochDay' || p.name === 'incentiveLamports') {
            bodyObj[p.name] = Number(val);
          } else {
            bodyObj[p.name] = val;
          }
        }
      }

      const res = await fetch(endpoint.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });
      const time = Math.round(performance.now() - start);
      const data = await res.json();

      setResponse({ status: res.status, body: data, time });

      if (res.status === 402 && data.x402) {
        setX402State('got402');
        setX402Data({
          amount: data.x402.amount,
          recipient: data.x402.recipient,
        });
      }
    } catch (err) {
      setResponse({
        status: 0,
        body: { error: (err as Error).message },
        time: Math.round(performance.now() - start),
      });
    } finally {
      setLoading(false);
    }
  }

  async function signAndSendPayment() {
    if (!publicKey || !signTransaction || !x402Data) return;
    setLoading(true);
    setX402State('signing');

    const start = performance.now();
    try {
      // Build payment TX
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(x402Data.recipient),
          lamports: x402Data.amount,
        })
      );

      // Sign (don't send — server submits)
      const signed = await signTransaction(tx);
      const serialized = signed.serialize();
      const base64 = Buffer.from(serialized).toString('base64');

      // Re-send with X-Payment header
      const bodyObj: Record<string, unknown> = {};
      for (const p of endpoint.params.filter((pr) => pr.type === 'body')) {
        const val = paramValues[p.name];
        if (val) {
          if (p.name === 'epochDay' || p.name === 'incentiveLamports') {
            bodyObj[p.name] = Number(val);
          } else {
            bodyObj[p.name] = val;
          }
        }
      }

      const res = await fetch(endpoint.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': base64,
        },
        body: JSON.stringify(bodyObj),
      });
      const time = Math.round(performance.now() - start);
      const data = await res.json();

      setX402State('sent');
      setResponse({ status: res.status, body: data, time });
    } catch (err) {
      setResponse({
        status: 0,
        body: { error: (err as Error).message },
        time: Math.round(performance.now() - start),
      });
    } finally {
      setLoading(false);
    }
  }

  // ─── Signature Flow ───────────────────────────────────────────

  async function signAndSend() {
    if (!publicKey || !signMessage) return;
    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      const message = endpoint.signatureMessage!;
      const messageBytes = new TextEncoder().encode(message);
      const sig = await signMessage(messageBytes);

      const res = await fetch(endpoint.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          signature: bs58.encode(sig),
          message,
        }),
      });
      const time = Math.round(performance.now() - start);
      const data = await res.json();
      setResponse({ status: res.status, body: data, time });
    } catch (err) {
      setResponse({
        status: 0,
        body: { error: (err as Error).message },
        time: Math.round(performance.now() - start),
      });
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-surface px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            &larr; Docs
          </Link>
          <h1 className="text-sm font-semibold text-foreground">API Playground</h1>
          <span className="text-[10px] font-mono text-muted bg-background px-1.5 py-0.5 rounded">
            devnet
          </span>
        </div>
        <WalletMultiButton />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop */}
        <aside className="hidden md:block w-56 border-r border-border bg-surface overflow-y-auto flex-shrink-0">
          <nav className="py-3">
            {GROUPS.map((group) => (
              <div key={group.label} className="mb-2">
                <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {group.label}
                </div>
                {group.ids.map((id) => {
                  const ep = ENDPOINTS.find((e) => e.id === id)!;
                  const active = selectedId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => selectEndpoint(id)}
                      className={`w-full text-left px-4 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                        active
                          ? 'bg-accent/10 text-accent border-l-2 border-accent'
                          : 'text-foreground hover:bg-surface-hover border-l-2 border-transparent'
                      }`}
                    >
                      <MethodBadge method={ep.method} />
                      <span className="truncate font-mono">
                        {ep.path.replace('/api/v1', '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile endpoint selector */}
        <div className="md:hidden border-b border-border bg-surface px-4 py-2 flex-shrink-0 w-full">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-full flex items-center justify-between text-sm font-mono text-foreground"
          >
            <span className="flex items-center gap-2">
              <MethodBadge method={endpoint.method} />
              {endpoint.path}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              className={`text-muted transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          {mobileOpen && (
            <div className="mt-2 border-t border-border pt-2 space-y-0.5">
              {GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted py-1">
                    {group.label}
                  </div>
                  {group.ids.map((id) => {
                    const ep = ENDPOINTS.find((e) => e.id === id)!;
                    return (
                      <button
                        key={id}
                        onClick={() => selectEndpoint(id)}
                        className={`w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 rounded ${
                          selectedId === id ? 'bg-accent/10 text-accent' : 'text-foreground'
                        }`}
                      >
                        <MethodBadge method={ep.method} />
                        <span className="font-mono">{ep.path.replace('/api/v1', '')}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main panel */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Endpoint header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <MethodBadge method={endpoint.method} />
              <code className="text-sm font-mono text-foreground">{endpoint.path}</code>
              <AuthBadge auth={endpoint.auth} />
            </div>
            <p className="text-xs text-muted">{endpoint.description}</p>
          </div>

          {/* Auth info */}
          {endpoint.auth === 'x402' && (
            <div className="flex items-center gap-2 text-xs text-accent bg-accent/5 border border-accent/10 rounded-lg px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span>
                x402 Payment: {endpoint.paymentAmount! / LAMPORTS_PER_SOL} SOL to treasury
                {!connected && ' — connect wallet to pay'}
              </span>
            </div>
          )}
          {endpoint.auth === 'signature' && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5.5 7L7 8.5L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="1.5" y="2.5" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span>
                Wallet Signature: sign &quot;{endpoint.signatureMessage}&quot;
                {!connected && ' — connect wallet to sign'}
              </span>
            </div>
          )}

          {/* Parameters */}
          {endpoint.params.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Parameters
              </h3>
              {endpoint.params.map((p) => (
                <div key={p.name} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <label className="text-xs font-mono text-muted w-36 flex-shrink-0 flex items-center gap-1">
                    {p.name}
                    {p.required && <span className="text-red-400">*</span>}
                    <span className="text-[10px] text-muted/50">({p.type})</span>
                  </label>
                  <input
                    type="text"
                    value={paramValues[p.name] || ''}
                    onChange={(e) =>
                      setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                    }
                    placeholder={p.placeholder}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono
                      text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
                  />
                </div>
              ))}
            </div>
          )}

          {/* x402 flow stepper */}
          {endpoint.auth === 'x402' && x402State !== 'idle' && (
            <X402Stepper step={x402State} />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {endpoint.auth === 'open' && (
              <button
                onClick={sendOpenRequest}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white
                  hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            )}

            {endpoint.auth === 'x402' && x402State === 'idle' && (
              <button
                onClick={sendX402Initial}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white
                  hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? 'Sending...' : 'Send (no payment)'}
              </button>
            )}

            {endpoint.auth === 'x402' && x402State === 'got402' && (
              <>
                <button
                  onClick={signAndSendPayment}
                  disabled={loading || !connected}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white
                    hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  {loading ? 'Signing...' : `Sign & Pay ${x402Data!.amount / LAMPORTS_PER_SOL} SOL`}
                </button>
                <button
                  onClick={() => { setX402State('idle'); setX402Data(null); setResponse(null); }}
                  className="px-3 py-2 rounded-xl text-sm text-muted hover:text-foreground transition-colors"
                >
                  Reset
                </button>
              </>
            )}

            {endpoint.auth === 'x402' && (x402State === 'signing' || x402State === 'sent') && (
              <button
                onClick={() => { setX402State('idle'); setX402Data(null); setResponse(null); }}
                className="px-3 py-2 rounded-xl text-sm text-muted hover:text-foreground transition-colors"
              >
                Reset
              </button>
            )}

            {endpoint.auth === 'signature' && (
              <button
                onClick={signAndSend}
                disabled={loading || !connected}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white
                  hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? 'Signing...' : 'Sign & Send'}
              </button>
            )}
          </div>

          {/* Response */}
          {response && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Response
                </h3>
                <StatusBadge status={response.status} />
                <span className="text-[10px] font-mono text-muted">
                  {response.time}ms
                </span>
              </div>
              <JsonViewer data={response.body} />
            </div>
          )}

          {/* Empty state */}
          {!response && !loading && (
            <div className="text-center py-12 text-muted text-xs">
              {endpoint.auth === 'open'
                ? 'Click "Send Request" to test this endpoint'
                : endpoint.auth === 'x402'
                ? 'Click "Send (no payment)" to see the 402 response, then sign a payment TX'
                : 'Connect wallet and click "Sign & Send" to test'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
