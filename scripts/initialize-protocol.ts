/**
 * Initialize the Sigil v2 protocol on-chain.
 * Run: npx tsx --skip-project scripts/initialize-protocol.ts
 */
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('GTc3X6f7CYSb9oAj25przd4FpyUuKhNHmh2ZhQMDXmy8');

async function main() {
  const rpc = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const keypairStr = process.env.SOLANA_KEYPAIR;
  if (!keypairStr) throw new Error('Set SOLANA_KEYPAIR env var');

  const collectionMintStr = process.env.NEXT_PUBLIC_COLLECTION_MINT;
  if (!collectionMintStr) throw new Error('Set NEXT_PUBLIC_COLLECTION_MINT env var (run create-collection first)');

  const incentiveWalletStr = process.env.NEXT_PUBLIC_INCENTIVE_WALLET;
  if (!incentiveWalletStr) throw new Error('Set NEXT_PUBLIC_INCENTIVE_WALLET env var');

  const keypair = Keypair.fromSecretKey(bs58.decode(keypairStr));
  const collectionMint = new PublicKey(collectionMintStr);
  const incentiveWallet = new PublicKey(incentiveWalletStr);
  const connection = new Connection(rpc, 'confirmed');

  console.log('Authority:', keypair.publicKey.toString());
  console.log('Collection Mint:', collectionMint.toString());
  console.log('Incentive Wallet:', incentiveWallet.toString());

  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: any) => { tx.sign(keypair); return tx; },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.sign(keypair)); return txs; },
  };
  const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });

  // Load IDL
  const idlPath = path.join(__dirname, '..', 'src', 'lib', 'idl', 'sigil.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new Program(idl as Idl, PROGRAM_ID, provider);

  // Derive Protocol PDA
  const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('proto')], PROGRAM_ID);
  console.log('Protocol PDA:', protocolPda.toString());

  // Check if already initialized
  try {
    const existing = await program.account.protocol.fetch(protocolPda);
    console.log('Protocol already initialized!');
    console.log('  Authority:', existing.authority.toString());
    console.log('  Treasury:', existing.treasury.toString());
    console.log('  Incentive Wallet:', existing.incentiveWallet.toString());
    console.log('  Total Minted:', existing.totalMinted);
    console.log('  Total Claims:', existing.totalClaims.toString());
    return;
  } catch {
    // Not initialized yet, proceed
  }

  // Initialize with collection mint AND incentive wallet
  const txSig = await program.methods
    .initialize(collectionMint, incentiveWallet)
    .accounts({
      protocol: protocolPda,
      authority: keypair.publicKey,
      systemProgram: new PublicKey('11111111111111111111111111111111'),
    })
    .rpc();

  console.log('\n=== Protocol Initialized ===');
  console.log('TX:', txSig);

  // Verify
  const proto = await program.account.protocol.fetch(protocolPda);
  console.log('Authority:', proto.authority.toString());
  console.log('Treasury:', proto.treasury.toString());
  console.log('Incentive Wallet:', proto.incentiveWallet.toString());
  console.log('Collection:', proto.collectionMint.toString());
  console.log('Tier prices (lamports):', {
    tier1: proto.tier1Price.toString(),
    tier2: proto.tier2Price.toString(),
    tier3: proto.tier3Price.toString(),
    tier4: proto.tier4Price.toString(),
  });
}

main().catch(console.error);
