/**
 * Update Farcaster Manifest Domain
 *
 * This script generates a new account association signature for the new domain.
 * Run: npx tsx scripts/update-domain.ts
 */

import { ViemLocalEip712Signer } from '@farcaster/hub-nodejs';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

const NEW_DOMAIN = 'basedorerased.vercel.app';
const FID = 1490126; // Your Farcaster ID from the header

async function main() {
    // Get private key from environment
    const privateKey = process.env.FARCASTER_CUSTODY_PRIVATE_KEY;

    if (!privateKey) {
        console.error('❌ FARCASTER_CUSTODY_PRIVATE_KEY not set');
        console.log('\nPlease set your Farcaster custody wallet private key:');
        console.log('export FARCASTER_CUSTODY_PRIVATE_KEY="0x..."');
        process.exit(1);
    }

    try {
        // Create account from private key
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        console.log('✅ Account address:', account.address);

        // Create EIP-712 signer
        const eip712Signer = new ViemLocalEip712Signer(account);

        // Create domain signature
        const signatureResult = await eip712Signer.signDomainAssociation({
            fid: BigInt(FID),
            domain: NEW_DOMAIN,
        });

        if (signatureResult.isOk()) {
            const signature = signatureResult.value;

            // Encode the signature parts to base64
            const header = Buffer.from(JSON.stringify({
                fid: FID,
                type: 'custody',
                key: account.address,
            })).toString('base64');

            const payload = Buffer.from(JSON.stringify({
                domain: NEW_DOMAIN,
            })).toString('base64');

            const sig = Buffer.from(signature).toString('base64');

            console.log('\n✅ New Account Association Generated:\n');
            console.log({
                header,
                payload,
                signature: sig,
            });

            // Update farcaster.json
            const manifestPath = path.join(process.cwd(), 'public', '.well-known', 'farcaster.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

            manifest.accountAssociation = {
                header,
                payload,
                signature: sig,
            };

            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
            console.log('\n✅ Updated public/.well-known/farcaster.json');
            console.log('\nNext steps:');
            console.log('1. Commit and push changes');
            console.log('2. Deploy to Vercel');
            console.log('3. Refresh the manifest in Farcaster Developer Portal');

        } else {
            console.error('❌ Failed to generate signature:', signatureResult.error);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
