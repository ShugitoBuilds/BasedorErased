const { createPublicClient, http, formatEther, parseAbi, formatUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

async function main() {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
        console.error('No DEPLOYER_PRIVATE_KEY found in .env');
        return;
    }

    const account = privateKeyToAccount(privateKey);
    console.log('Wallet Address:', account.address);

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(),
    });

    // Check ETH Balance
    const ethBalance = await client.getBalance({ address: account.address });
    console.log('ETH Balance:', formatEther(ethBalance), 'ETH');

    // Check USDC Balance
    const usdcAddress = process.env.USDC_ADDRESS;
    if (usdcAddress) {
        const usdcAbi = parseAbi(['function balanceOf(address) view returns (uint256)']);
        const usdcBalance = await client.readContract({
            address: usdcAddress,
            abi: usdcAbi,
            functionName: 'balanceOf',
            args: [account.address],
        });
        console.log('USDC Balance:', formatUnits(usdcBalance, 6), 'USDC');
    } else {
        console.log('No USDC_ADDRESS found in .env');
    }
}

main().catch(console.error);
