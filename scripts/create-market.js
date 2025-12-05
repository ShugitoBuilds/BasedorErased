const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("\n🎯 Creating test market...");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("❌ CONTRACT_ADDRESS not set in .env");
    process.exit(1);
  }

  // Get contract instance
  const SimplePredictionMarket = await hre.ethers.getContractAt(
    "SimplePredictionMarket",
    contractAddress
  );

  // Market parameters
  const castUrl = "https://warpcast.com/dwr.eth/0x12345678"; // Example cast
  const threshold = 100; // 100 likes
  const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now

  console.log("\n📝 Market Details:");
  console.log("Cast URL:", castUrl);
  console.log("Threshold:", threshold, "likes");
  console.log("Deadline:", new Date(deadline * 1000).toLocaleString());

  // Create market
  console.log("\n⏳ Creating market...");
  const tx = await SimplePredictionMarket.createMarket(
    castUrl,
    threshold,
    deadline
  );

  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();

  // Get market ID from event
  const event = receipt.logs.find(
    (log) => {
      try {
        const parsed = SimplePredictionMarket.interface.parseLog(log);
        return parsed.name === "MarketCreated";
      } catch {
        return false;
      }
    }
  );

  if (event) {
    const parsed = SimplePredictionMarket.interface.parseLog(event);
    const marketId = parsed.args.marketId;

    console.log("\n✅ Market created successfully!");
    console.log("Market ID:", marketId.toString());
    console.log("\n🔗 View on Basescan:");

    if (network === "baseSepolia") {
      console.log(`https://sepolia.basescan.org/tx/${tx.hash}`);
    } else if (network === "base") {
      console.log(`https://basescan.org/tx/${tx.hash}`);
    }

    console.log("\n📊 Next steps:");
    console.log("1. Update Frame to use market ID:", marketId.toString());
    console.log("2. Test betting in the Frame");
    console.log("3. Resolve market after deadline");
  } else {
    console.log("✅ Market created (couldn't parse event)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
