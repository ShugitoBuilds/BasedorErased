# 🎱 Based or Erased: Master Project Context through Dec 2025

**Version:** 2.0.0 (Consolidated)
**Status:** Testing & Verification (Sync Logic)
**Last Updated:** December 09, 2025

---

## 1. Mission & Vision 🎯
**"Based or Erased"** is a prediction market Mini App integrated natively into Farcaster.
- **The Core Question:** "Will this Cast go viral (Based) or flop (Erased)?"
- **The Mechanic:** Users bet USDC on whether a specific Cast will hit a "Like Threshold" (e.g., 50 Power Likes) within 24 hours.
- **The Vibe:** Crypto-native, high-stakes, fast-paced, and extremely "Based" aesthetics.

---

## 2. Technical Architecture 🛠️

### Core Stack
- **Frontend / Framework:** Next.js 16 (App Router), React 19.
- **Styling:** TailwindCSS v3/v4 with custom "Vibrant Dark Mode" aesthetics.
- **Blockchain:** Base Sepolia (Testnet).
- **Web3 Interaction:** Wagmi v2, Viem, ConnectKit/RainbowKit (via Farcaster MiniApp SDK).
- **Database:** Supabase (Postgres) - Used for `CastSnapshots` (Data Integrity) and `UserScore` Caching.
- **Data Provider:** Neynar API (Farcaster Social Graph & Validation).

### Smart Contract
- **Type:** Binary Prediction Market (Parimutuel / Fixed Odds logic variant).
- **Contract Address:** `0x15707D3224853d06628EA00628C3E3E7824a32a4` (Base Sepolia).
- **Token:** USDC (Mock/Testnet) `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- **Key Features:**
    - `betMoon` / `betDoom`: Place bets.
    - `resolveMarket`: Oracle triggers payout based on outcome.
    - `claimWinnings`: Winners withdraw their share of the pool.
    - `PROTOCOL_FEE`: 1% taken by the house (Verified active).

---

## 3. Operational Guides 📖

### A. Domain Updates & Farcaster Signature
When changing the domain (e.g., from `cast-predict` to `basedorerased.vercel.app`), you **MUST** regenerate the `farcaster.json` signature or the Mini App will fail to load in the client.

**Option 1: Automated Script (Recommended)**
```bash
# Set your Farcaster custody wallet private key
export FARCASTER_CUSTODY_PRIVATE_KEY="0x..."
# Run the update script
npx tsx scripts/update-domain.ts
```

**Option 2: Manual Verification**
1. Go to [Farcaster Developer Portal](https://dev.farcaster.xyz).
2. App Settings -> Update "App URL".
3. Use the verify tool to generate a new signature.
4. Update `public/.well-known/farcaster.json` with the new data.

### B. Neynar API Optimization (Critical)
To prevent API overages (High Billable Usage):
1.  **Fast Path:** If a Cast has >300 raw likes, the resolver assumes it has met the "Power Like" threshold and resolves as `MOON` immediately. This saves expensive user-lookup calls.
2.  **User Score Caching:** We now cache a user's "Power Badge" status in Supabase (`user_scores` table) for 7 days.
    - **Logic:** `app/api/cron/resolve/route.ts`
    - **Setup:** `scripts/setup-cache-db.js` runs the SQL migration.

---

## 4. Change Log 📝

### v2.2.3 - Infrastructure & UX Scale-Up (Dec 9, 2025)
*   **Infrastructure & Security:**
    *   **Supabase Security:** Enabled Row Level Security (RLS) on all public tables.
    *   **External Sync Engine:** Replaced Vercel Cron with **cron-job.org** to bypass deployment timeouts.
        *   Endpoint: `/api/cron/sync` (Secured via `CRON_SECRET`).
    *   **Deployment:** Switched to **Vercel CLI** to bypass stuck GitHub Webhooks.
*   **Inline Betting UI:**
    *   Replaced "Bet Now" popup with a sleek **Inline Betting** interface directly in the Market Card.
*   **Versioning:**
    *   Added visible build version banner (e.g., `v2.2.3 - Cron Active`) for instant verification.

### v2.1.0 - Real-Time Sync & Robustness (Dec 8, 2025)
*   **Critical Sync Fixes:**
    *   **ABI Mismatch Resolved:** Corrected `MarketCreated` event signature.
    *   **Infinite Loop Prevention:** Added `syncAttempted` state to client hooks.
*   **UI/UX Improvements:**
    *   **Visual Trust:** Added "Build Timestamp" banner.

### v2.0.0 - Optimization & Branding Overhaul (Dec 7, 2025)
*   **Neynar API Optimization:** Fast Path resolution + Caching.
*   **Branding:** New "Based or Erased" betting coin logo.

---

## 5. Future Roadmap 🚀
*   **Immediate Focus:** End-to-End Process Verification.
    *   Verify Market Creation -> Database Sync.
    *   Verify Betting (Moon/Doom) updates odds in real-time.
    *   Verify Resolution (Time/Threshold met).
    *   Verify Claiming of Winnings.
*   **Mainnet Launch:** Deploy contract to Base Mainnet.
