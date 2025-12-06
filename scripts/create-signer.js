const { config } = require('dotenv');
config();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
    console.error("❌ Error: NEYNAR_API_KEY is missing in .env");
    process.exit(1);
}

async function createSigner() {
    console.log("🚀 Creating Managed Signer...");

    try {
        const response = await fetch("https://api.neynar.com/v2/farcaster/signer", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api_key": NEYNAR_API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        console.log("\n✅ Signer Created Successfully!");
        console.log("---------------------------------------------------");
        console.log(`📝 Signer UUID: ${data.signer_uuid}`);
        console.log(`🔗 Auth Link:   ${data.link}`);
        console.log("---------------------------------------------------");
        console.log("\n👉 ACTION REQUIRED:");
        console.log("1. Open the 'Auth Link' above on your phone (or copy to mobile).");
        console.log("2. It will open Warpcast. Approve the connection.");
        console.log("3. Once approved, copy the 'Signer UUID' and paste it into Vercel env vars as NEYNAR_SIGNER_UUID.");

    } catch (error) {
        console.error("❌ Failed to create signer:", error.message);
    }
}

createSigner();
