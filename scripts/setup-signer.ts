/**
 * One-time setup: Create a Neynar managed signer for @sigilbond.
 *
 * Usage:
 *   NEYNAR_API_KEY=<key> npx tsx scripts/setup-signer.ts
 *
 * Steps:
 *   1. Creates a sponsored signer via Neynar
 *   2. Prints an approval URL — open it in Warpcast to approve
 *   3. Polls until approved, then prints the signer_uuid to store in Vercel
 */

const API_KEY = process.env.NEYNAR_API_KEY;
if (!API_KEY) {
  console.error('Set NEYNAR_API_KEY env var');
  process.exit(1);
}

const headers = {
  accept: 'application/json',
  'content-type': 'application/json',
  'x-api-key': API_KEY,
};

async function main() {
  // Step 1: Create a sponsored signer
  console.log('Creating sponsored signer...');
  const createRes = await fetch('https://api.neynar.com/v2/farcaster/signer', {
    method: 'POST',
    headers,
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error('Failed to create signer:', createRes.status, err);
    process.exit(1);
  }

  const signer = await createRes.json();
  console.log('Signer created:', {
    signer_uuid: signer.signer_uuid,
    public_key: signer.public_key,
    status: signer.status,
  });

  // Step 2: Register as sponsored signer (Neynar covers gas)
  console.log('\nRegistering sponsored signer...');
  const regRes = await fetch('https://api.neynar.com/v2/farcaster/signer/signed_key', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      signer_uuid: signer.signer_uuid,
      sponsor: true,
    }),
  });

  if (!regRes.ok) {
    const err = await regRes.text();
    console.error('Failed to register signer:', regRes.status, err);
    console.log('\nIf this fails, the signer may need manual approval.');
    console.log('signer_uuid:', signer.signer_uuid);
    process.exit(1);
  }

  const registered = await regRes.json();
  const approvalUrl = registered.signer_approval_url;

  if (approvalUrl) {
    console.log('\n=== OPEN THIS URL IN WARPCAST TO APPROVE ===');
    console.log(approvalUrl);
    console.log('=============================================\n');
  } else {
    console.log('Response:', JSON.stringify(registered, null, 2));
  }

  // Step 3: Poll for approval
  console.log('Polling for approval (Ctrl+C to stop, signer_uuid is saved above)...');
  const uuid = signer.signer_uuid;

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const checkRes = await fetch(`https://api.neynar.com/v2/farcaster/signer?signer_uuid=${uuid}`, {
      headers: { accept: 'application/json', 'x-api-key': API_KEY },
    });

    if (!checkRes.ok) continue;

    const status = await checkRes.json();
    console.log(`  [${i + 1}] status: ${status.status}`);

    if (status.status === 'approved') {
      console.log('\n=== SIGNER APPROVED ===');
      console.log(`signer_uuid: ${uuid}`);
      console.log(`fid: ${status.fid}`);
      console.log('\nAdd to Vercel:');
      console.log(`  NEYNAR_SIGIL_SIGNER_UUID=${uuid}`);
      console.log('=======================');
      process.exit(0);
    }
  }

  console.log('\nTimed out waiting for approval. Run again or approve manually.');
  console.log(`signer_uuid: ${uuid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
