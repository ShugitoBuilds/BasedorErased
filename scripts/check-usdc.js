const hre = require("hardhat");

async function main() {
  const address = "0x05EEBF02305BF34C446C298105174e099C716bb9";
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

  console.log(`\n🔍 Checking USDC balance on Base Sepolia...`);

  // USDC ABI (just the balanceOf function)
  const usdcABI = [
    {
      "constant": true,
      "inputs": [{"name": "_owner", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "balance", "type": "uint256"}],
      "type": "function"
    }
  ];

  const usdc = await hre.ethers.getContractAt(usdcABI, usdcAddress);
  const balance = await usdc.balanceOf(address);
  const balanceInUsdc = hre.ethers.formatUnits(balance, 6); // USDC has 6 decimals

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`💵 Address: ${address}`);
  console.log(`   USDC Balance: ${balanceInUsdc} USDC`);
  console.log(`   Raw: ${balance.toString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (parseFloat(balanceInUsdc) > 0) {
    console.log("\n✅ You have USDC for betting!");
  } else {
    console.log("\n⚠️  No USDC balance found.");
    console.log("   Get testnet USDC from: https://faucet.circle.com/");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
