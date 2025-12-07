# Domain Update Guide: cast-predict → basedorerased

## What Was Changed

I've updated all references from `cast-predict.vercel.app` to `basedorerased.vercel.app` in the following files:

1. **public/.well-known/farcaster.json**
   - Updated all URLs in `frame` and `miniapp` sections
   - Updated the `payload` (base64 encoded domain)
   - Set signature to placeholder (needs regeneration)

2. **app/api/webhook/route.ts** (line 15)
   - Updated fallback APP_URL

3. **app/miniapp/market/[id]/page.tsx** (line 29)
   - Updated fallback APP_URL

4. **scripts/generate-signature.js** (line 18)
   - Updated domain constant

## Critical: Regenerate Account Association Signature

The `accountAssociation.signature` in `farcaster.json` is cryptographically tied to the domain name. You MUST regenerate it with your custody wallet private key.

### Option 1: Use the Script (Recommended)

```bash
# Set your Farcaster custody wallet private key
export FARCASTER_CUSTODY_PRIVATE_KEY="0x..."

# Run the update script
npx tsx scripts/update-domain.ts
```

This will automatically update `public/.well-known/farcaster.json` with the new signature.

### Option 2: Use Farcaster Developer Portal

1. Go to [Farcaster Developer Portal](https://dev.farcaster.xyz)
2. Navigate to your app settings
3. Update the domain to `basedorerased.vercel.app`
4. Use their domain verification tool to generate a new signature
5. Copy the new `accountAssociation` object into `farcaster.json`

## Environment Variables to Check

Make sure these are set correctly in Vercel:

```bash
NEXT_PUBLIC_APP_URL=https://basedorerased.vercel.app
```

## Deployment Steps

1. **Generate new signature** (see above)
2. **Commit changes**:
   ```bash
   git add .
   git commit -m "Update domain from cast-predict to basedorerased"
   git push
   ```
3. **Deploy to Vercel** (should auto-deploy on push)
4. **Verify manifest**:
   ```bash
   curl https://basedorerased.vercel.app/.well-known/farcaster.json
   ```
5. **Test in Farcaster**:
   - Click "Refresh" in the Farcaster Developer Portal
   - The error should be resolved

## Files Modified

- `public/.well-known/farcaster.json`
- `app/api/webhook/route.ts`
- `app/miniapp/market/[id]/page.tsx`
- `scripts/generate-signature.js`

## New Files Created

- `scripts/update-domain.ts` - Helper script to regenerate signature
- `DOMAIN_UPDATE_GUIDE.md` - This file

## Troubleshooting

If you still see errors after updating:

1. **Clear Vercel cache**: Redeploy with `vercel --force`
2. **Check manifest endpoint**: Visit `https://basedorerased.vercel.app/.well-known/farcaster.json`
3. **Verify signature**: The signature should NOT be `PLACEHOLDER_SIGNATURE_NEEDS_REGENERATION`
4. **Check Farcaster Portal**: Make sure domain is updated there too
