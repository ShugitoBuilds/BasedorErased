const { ethers } = require("hardhat");

async function main() {
  console.log("🔐 Generating new wallet for deployment...\n");

  const wallet = ethers.Wallet.createRandom();

  console.log("✅ Wallet generated!");
  console.log("\n📋 Wallet Details:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n⚠️  IMPORTANT:");
  console.log("1. Save the private key securely (never commit to git)");
  console.log("2. Add to .env.local:");
  console.log(`   DEPLOYER_PRIVATE_KEY=${wallet.privateKey}`);
  console.log("3. Get Base Sepolia ETH from faucet:");
  console.log("   https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
  console.log(`   Send to: ${wallet.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
