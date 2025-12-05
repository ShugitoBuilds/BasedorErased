const hre = require("hardhat");

async function main() {
  const address = "0x05EEBF02305BF34C446C298105174e099C716bb9";

  // Detect which network we're on
  const network = hre.network.name;
  const networkName = network === "base" ? "Base Mainnet" :
                      network === "baseSepolia" ? "Base Sepolia" :
                      network;

  console.log(`\n🔍 Checking balance on ${networkName}...`);

  const balance = await hre.ethers.provider.getBalance(address);
  const balanceInEth = hre.ethers.formatEther(balance);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`💰 Address: ${address}`);
  console.log(`   Balance: ${balanceInEth} ETH on ${networkName}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (parseFloat(balanceInEth) > 0.001) {
    console.log("\n✅ You have enough ETH to deploy!");
    console.log(`   Run: npx hardhat run scripts/deploy.js --network ${network}`);
  } else {
    console.log("\n⚠️  Not enough ETH for deployment yet.");
    if (network === "base") {
      console.log("   You'll need to fund this wallet with real ETH on Base Mainnet.");
      console.log("   You can bridge ETH to Base at: https://bridge.base.org");
    } else {
      console.log("   Get testnet ETH from:");
      console.log("   https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
