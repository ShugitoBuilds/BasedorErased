const hre = require("hardhat");

// USDC addresses on different networks
const USDC_ADDRESSES = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base Mainnet USDC
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
  localhost: "0x0000000000000000000000000000000000000000", // Will deploy mock
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network);
  console.log(
    "Account balance:",
    (await hre.ethers.provider.getBalance(deployer.address)).toString()
  );

  // Get USDC address for this network
  const usdcAddress = USDC_ADDRESSES[network];

  if (!usdcAddress || usdcAddress === "0x0000000000000000000000000000000000000000") {
    console.log("\n⚠️  No USDC address configured for this network");
    console.log("For localhost, you can deploy a mock USDC contract");
    return;
  }

  console.log("\nUsing USDC at:", usdcAddress);

  // Deploy SimplePredictionMarket
  console.log("\nDeploying SimplePredictionMarket...");
  const SimplePredictionMarket = await hre.ethers.getContractFactory(
    "SimplePredictionMarket"
  );
  const market = await SimplePredictionMarket.deploy(usdcAddress);

  await market.waitForDeployment();

  const marketAddress = await market.getAddress();

  console.log("\n✅ SimplePredictionMarket deployed to:", marketAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network,
    contractAddress: marketAddress,
    usdcAddress: usdcAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  console.log("\n📝 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Verify on Basescan (if not localhost)
  if (network !== "localhost" && network !== "hardhat") {
    console.log("\n⏳ Waiting 30 seconds before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log("\n🔍 Verifying contract on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: marketAddress,
        constructorArguments: [usdcAddress],
      });
      console.log("✅ Contract verified on Basescan");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }

  console.log("\n🎉 Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Update .env with CONTRACT_ADDRESS=" + marketAddress);
  console.log("2. Test creating a market");
  console.log("3. Update Frame UI to interact with contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
