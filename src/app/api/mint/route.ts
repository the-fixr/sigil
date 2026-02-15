import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createNft, findMetadataPda, mplTokenMetadata, verifyCollectionV1 } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, keypairIdentity, publicKey } from '@metaplex-foundation/umi';
import {
  getConnection,
  getServerKeypair,
  getProgram,
  getProtocolPda,
  pollConfirmation,
  MINT_PRICE_LAMPORTS,
  TREASURY,
  MAX_SUPPLY,
  COLLECTION_MINT,
} from '@/lib/solana';
import { getServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { txSignature, wallet } = await request.json();
    if (!txSignature || !wallet) {
      return NextResponse.json({ error: 'Missing txSignature or wallet' }, { status: 400 });
    }

    const connection = getConnection();
    const supabase = getServiceClient();

    // 1. One NFT per wallet — check DB
    const { count: existingCount } = await supabase
      .from('nft_mints')
      .select('*', { count: 'exact', head: true })
      .eq('owner_wallet', wallet);
    if ((existingCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Already minted — 1 Sigil per wallet' }, { status: 400 });
    }

    // 2. Verify payment TX
    await pollConfirmation(connection, txSignature);
    const tx = await connection.getParsedTransaction(txSignature, { maxSupportedTransactionVersion: 0 });
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 400 });

    const instructions = tx.transaction.message.instructions;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transfer = instructions.find((ix: any) => {
      if ('parsed' in ix && ix.parsed?.type === 'transfer') {
        return (
          ix.parsed.info.destination === TREASURY.toString() &&
          ix.parsed.info.lamports >= MINT_PRICE_LAMPORTS
        );
      }
      return false;
    });
    if (!transfer) {
      return NextResponse.json({ error: 'Payment not found in transaction' }, { status: 400 });
    }

    // 3. Check supply
    const { count } = await supabase.from('nft_mints').select('*', { count: 'exact', head: true });
    if ((count ?? 0) >= MAX_SUPPLY) {
      return NextResponse.json({ error: 'Max supply reached' }, { status: 400 });
    }

    const tokenId = (count ?? 0) + 1;

    // 4. Mint NFT via Umi
    const serverKeypair = getServerKeypair();
    const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const umi = createUmi(rpc).use(mplTokenMetadata());

    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(serverKeypair.secretKey);
    umi.use(keypairIdentity(umiKeypair));

    const mintSigner = generateSigner(umi);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    await createNft(umi, {
      mint: mintSigner,
      name: `Sigil #${tokenId}`,
      symbol: 'SIGIL',
      uri: `${baseUrl}/api/nft/metadata`,
      sellerFeeBasisPoints: { basisPoints: 0n, identifier: '%', decimals: 2 },
      tokenOwner: publicKey(wallet),
      isMutable: true,
      collection: COLLECTION_MINT
        ? { key: publicKey(COLLECTION_MINT.toString()), verified: false }
        : undefined,
    }).sendAndConfirm(umi);

    // 5. Verify collection membership (non-critical)
    if (COLLECTION_MINT) {
      try {
        const metadataPda = findMetadataPda(umi, { mint: mintSigner.publicKey });
        await verifyCollectionV1(umi, {
          metadata: metadataPda,
          collectionMint: publicKey(COLLECTION_MINT.toString()),
        }).sendAndConfirm(umi);
      } catch (err) {
        console.error('Collection verification failed (non-critical):', err);
      }
    }

    // 6. Record in DB
    const mintAddress = mintSigner.publicKey.toString();
    await supabase.from('nft_mints').insert({
      mint_address: mintAddress,
      owner_wallet: wallet,
      token_id: tokenId,
      minted_at: new Date().toISOString(),
    });

    // 7. Record mint on-chain (increment counter)
    try {
      const program = getProgram();
      const [protocolPda] = getProtocolPda();
      await program.methods
        .recordMint()
        .accounts({
          protocol: protocolPda,
          authority: serverKeypair.publicKey,
        })
        .rpc();
    } catch (err) {
      console.error('recordMint on-chain failed (non-critical):', err);
    }

    return NextResponse.json({
      success: true,
      mintAddress,
      tokenId,
    });
  } catch (error) {
    console.error('Mint error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
