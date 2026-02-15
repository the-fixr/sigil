'use client';

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const MINT_PRICE_SOL = 0.01;
const MAX_SUPPLY = 10_000;
const TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY || 'CGiuetrCxiaibJuxxCvrRjMyEjgmVEngxmvBXJtrmB5y'
);

interface MintCardProps {
  totalMinted: number;
  onMinted: () => void;
}

export default function MintCard({ totalMinted, onMinted }: MintCardProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState('');

  const isSoldOut = totalMinted >= MAX_SUPPLY;
  const progress = (totalMinted / MAX_SUPPLY) * 100;

  async function handleMint() {
    if (!publicKey || isSoldOut) return;
    setMinting(true);
    setStatus('Sending payment...');

    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY,
          lamports: Math.round(MINT_PRICE_SOL * LAMPORTS_PER_SOL),
        })
      );
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signature = await sendTransaction(tx, connection);
      setStatus('Minting NFT...');

      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txSignature: signature, wallet: publicKey.toString() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mint failed');

      setStatus(`Sigil #${data.tokenId} minted`);
      onMinted();
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus((err as Error).message);
      setTimeout(() => setStatus(''), 4000);
    } finally {
      setMinting(false);
    }
  }

  return (
    <button
      onClick={handleMint}
      disabled={!publicKey || minting || isSoldOut}
      className="group relative w-full max-w-sm mx-auto block rounded-2xl overflow-hidden
        bg-surface border border-border
        transition-all duration-300
        hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5
        disabled:opacity-60 disabled:cursor-not-allowed
        active:scale-[0.98]"
    >
      {/* NFT Preview Image */}
      <div className="aspect-square w-full bg-gradient-to-br from-[#0c0a1a] via-[#1a1040] to-[#0c0a1a] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            <circle cx="120" cy="120" r="80" stroke="#8b5cf6" strokeWidth="1"/>
            <circle cx="120" cy="120" r="60" stroke="#8b5cf6" strokeWidth="0.5"/>
            <circle cx="120" cy="120" r="100" stroke="#8b5cf6" strokeWidth="0.5"/>
            <line x1="120" y1="20" x2="120" y2="220" stroke="#8b5cf6" strokeWidth="0.5"/>
            <line x1="20" y1="120" x2="220" y2="120" stroke="#8b5cf6" strokeWidth="0.5"/>
            <line x1="49" y1="49" x2="191" y2="191" stroke="#8b5cf6" strokeWidth="0.5"/>
            <line x1="191" y1="49" x2="49" y2="191" stroke="#8b5cf6" strokeWidth="0.5"/>
          </svg>
        </div>

        <div className="relative z-10 text-center">
          <div className="text-5xl font-extrabold tracking-tight text-white/90 mb-2">SIGIL</div>
          <div className="text-sm text-white/40">Billboard That Pays Rent</div>
        </div>

        <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white font-semibold text-lg bg-accent/80 px-6 py-2.5 rounded-full backdrop-blur-sm">
            {isSoldOut ? 'Sold Out' : minting ? 'Minting...' : 'Mint Now'}
          </span>
        </div>
      </div>

      {/* Card info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">Sigil</span>
          <span className="text-sm font-mono text-accent">{MINT_PRICE_SOL} SOL</span>
        </div>

        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progress, 1)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>{totalMinted.toLocaleString()} minted</span>
          <span>10,000</span>
        </div>

        {status && (
          <div className="mt-3 text-xs text-center text-accent truncate">{status}</div>
        )}
      </div>
    </button>
  );
}
