/**
 * Close the old Sigil v1 Protocol PDA (to re-initialize with v2 layout).
 * Run: npx tsx --skip-project scripts/close-protocol.ts
 */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import * as bs58Module from 'bs58';
import { createHash } from 'crypto';

const bs58 = (bs58Module as any).default || bs58Module;

const PROGRAM_ID = new PublicKey('GTc3X6f7CYSb9oAj25przd4FpyUuKhNHmh2ZhQMDXmy8');

// Anchor discriminator: sha256("global:close_protocol")[:8]
const DISCRIMINATOR = Buffer.from(
  createHash('sha256').update('global:close_protocol').digest().subarray(0, 8)
);

async function main() {
  const rpc = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const keypairStr = process.env.SOLANA_KEYPAIR;
  if (!keypairStr) throw new Error('Set SOLANA_KEYPAIR env var');

  const keypair = Keypair.fromSecretKey(bs58.decode(keypairStr));
  const connection = new Connection(rpc, 'confirmed');

  // Derive Protocol PDA
  const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('proto')], PROGRAM_ID);

  console.log('Authority:', keypair.publicKey.toString());
  console.log('Protocol PDA:', protocolPda.toString());

  // Check if protocol exists
  const info = await connection.getAccountInfo(protocolPda);
  if (!info) {
    console.log('Protocol PDA does not exist — nothing to close.');
    return;
  }
  console.log('Protocol PDA size:', info.data.length, 'bytes, lamports:', info.lamports);

  // Build close_protocol instruction
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: protocolPda, isSigner: false, isWritable: true },
      { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: DISCRIMINATOR,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);

  const txSig = await connection.sendRawTransaction(tx.serialize());
  console.log('TX sent:', txSig);

  // Poll for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await connection.getSignatureStatus(txSig);
    if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
      console.log('Confirmed!');
      break;
    }
    if (status.value?.err) {
      console.error('TX failed:', status.value.err);
      return;
    }
  }

  // Verify PDA is closed
  const after = await connection.getAccountInfo(protocolPda);
  if (!after || after.lamports === 0) {
    console.log('Protocol PDA closed successfully.');
  } else {
    console.log('Warning: PDA still exists with', after.lamports, 'lamports');
  }
}

main().catch(console.error);
