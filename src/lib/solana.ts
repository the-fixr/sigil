import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import idlJson from './idl/sigil.json';

export const SIGIL_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SIGIL_PROGRAM_ID || 'GTc3X6f7CYSb9oAj25przd4FpyUuKhNHmh2ZhQMDXmy8'
);

export const TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY || 'CGiuetrCxiaibJuxxCvrRjMyEjgmVEngxmvBXJtrmB5y'
);

export const INCENTIVE_WALLET = process.env.NEXT_PUBLIC_INCENTIVE_WALLET
  ? new PublicKey(process.env.NEXT_PUBLIC_INCENTIVE_WALLET)
  : null;

export const COLLECTION_MINT = process.env.NEXT_PUBLIC_COLLECTION_MINT
  ? new PublicKey(process.env.NEXT_PUBLIC_COLLECTION_MINT)
  : null;

export const MAX_SUPPLY = 10_000;
export const MINT_PRICE_SOL = 0.01;
export const MINT_PRICE_LAMPORTS = MINT_PRICE_SOL * 1e9; // 10_000_000
export const MIN_INCENTIVE_SOL = 0.1;
export const MIN_INCENTIVE_LAMPORTS = MIN_INCENTIVE_SOL * 1e9; // 100_000_000
export const DAILY_BONUS_THRESHOLD = 1000; // first 1000 check-ins get 2x weight

export function getConnection(): Connection {
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpc, 'confirmed');
}

export function getServerKeypair(): Keypair {
  const key = process.env.SOLANA_KEYPAIR;
  if (!key) throw new Error('SOLANA_KEYPAIR not set');
  return Keypair.fromSecretKey(bs58.decode(key));
}

/** Derive Protocol PDA */
export function getProtocolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('proto')], SIGIL_PROGRAM_ID);
}

/** Derive DayClaim PDA for a given epoch day */
export function getDayClaimPda(epochDay: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(epochDay));
  return PublicKey.findProgramAddressSync([Buffer.from('day'), buf], SIGIL_PROGRAM_ID);
}

/** Get the current epoch day */
export function getCurrentEpochDay(): number {
  return Math.floor(Date.now() / 1000 / 86400);
}

/** Get the Anchor program (server-side, with server keypair as wallet) */
export function getProgram(): Program {
  const connection = getConnection();
  const keypair = getServerKeypair();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet: any = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: { sign: (k: typeof keypair) => void }) => { tx.sign(keypair); return tx; },
    signAllTransactions: async (txs: { sign: (k: typeof keypair) => void }[]) => { txs.forEach(tx => tx.sign(keypair)); return txs; },
  };
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  return new Program(idlJson as Idl, SIGIL_PROGRAM_ID, provider);
}

/** Poll for transaction confirmation (Alchemy-compatible, no signatureSubscribe) */
export async function pollConfirmation(
  connection: Connection,
  signature: string,
  maxRetries = 30,
  intervalMs = 2000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const status = await connection.getSignatureStatus(signature);
    if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
      if (status.value.err) throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      return true;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Transaction confirmation timeout');
}
