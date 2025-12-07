# 🎱 Based or Erased: Project Context & Handover

**Version:** 1.0.0
**Status:** Feature Complete (Phases 1-9 Finished)
**Last Updated:** December 06, 2025

---

## 1. Mission & Vision 🎯
**"Based or Erased"** is a prediction market Mini App integrated natively into Farcaster.
- **The Core Question:** "Will this Cast go viral (MOON) or flop (DOOM)?"
- **The Mechanic:** Users bet USDC on whether a specific Cast will hit a "Like Threshold" (e.g., 50 Power Likes) within 24 hours.
- **The Vibe:** Crypto-native, high-stakes, fast-paced, and extremely "Based" aesthetics.

## 2. Technical Scope 🛠️

### Core Stack
- **Frontend / Framework:** Next.js 16 (App Router), React 19.
- **Styling:** TailwindCSS v3/v4 with custom "Vibrant Dark Mode" aesthetics.
- **Blockchain:** Base Sepolia (Testnet).
- **Web3 Interaction:** Wagmi v2, Viem, ConnectKit/RainbowKit (via Farcaster MiniApp SDK).
- **Database:** Supabase (Postgres) - Used for `CastSnapshots` (Data Integrity).
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

## 3. Implemented Features (The "Done" List) ✅

### Phase 1-6: Foundation & UI
- [x] **Mini App UI:** Fully responsive, embedded in Farcaster Frames.
- [x] **Betting Logic:** Connect Wallet, Approve USDC, Place Bet.
- [x] **Real-time Updates:** Odds and Pool size refresh automatically.
- [x] **Rebranding:** Full "Based or Erased" visual identity applied.

### Phase 7: Sybil Resistance (The "Power Filter")
- [x] **Oracle Upgrade:** Markets now resolve based on **Power Badge Likes**, not raw likes.
- [x] **Rationale:** Prevents botting exploits (buying 1000 fake likes for $5).
- [x] **Threshold:** ~50 Power Badge Likes = "Viral".

### Phase 8: Data Integrity
- [x] **Snapshotting:** Cast text/author is saved to Supabase on market creation.
- [x] **Anti-Griefing:** If a Cast is deleted, the Oracle checks the Snapshot.
    - If Snapshot exists + Cast deleted = Market resolves as **DOOM (Erased)**.

### Phase 9: Economics
- [x] **Bet Caps:** Maximum bet limited to **500 USDC** to protect liquidity.
- [x] **Variable Bets:** Users can input any amount between 1 and 500 USDC.
- [x] **Protocol Fees:** Confirmed 1% fee on the smart contract.

## 4. How to Resume Development 🚀

### A. Environment Setup
1.  **Install:** `npm install`
2.  **Env Vars:** Ensure `.env.local` is populated (see `.env.example`).
    - `NEXT_PUBLIC_CONTRACT_ADDRESS`
    - `NEYNAR_API_KEY`
    - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`
    - `DEPLOYER_PRIVATE_KEY` (for admin scripts)

### B. Running Locally
- `npm run dev` -> Opens http://localhost:3000
- **Test Mode:** Use the "Bypass Frame" link on the landing page to test the Mini App in a browser without Farcaster context (mock context is provided).

### C. Admin / Automation Scripts
- **Resolution Cron:** `/api/cron/resolve` (Updates market status).
- **Scripts:** Check `scripts/` folder for utilities like `check-fee.js`.

---

**Note to AI Agents:**
This file (`PROJECT_CONTEXT.md`) explains *what* we built and *why*.
For a detailed history of file changes, refer to `CHANGELOG.md`.
For specific task tracking (if active), check `task.md` in the `.gemini` folder, though this Context file determines the overall truth.
