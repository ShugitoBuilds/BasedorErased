const { createPublicClient, http, parseAbi } = require('viem');
const { baseSepolia } = require('viem/chains');

// Verified Contract Address
const CONTRACT_ADDRESS = '0x15707D3224853d06628EA00628C3E3E7824a32a4';

const abi = parseAbi([
    'function PROTOCOL_FEE() view returns (uint256)',
    'function FEE_DENOMINATOR() view returns (uint256)'
]);

async function checkFee() {
    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(),
    });

    try {
        const fee = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: abi,
            functionName: 'PROTOCOL_FEE',
        });

        const denominator = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: abi,
            functionName: 'FEE_DENOMINATOR',
        });

        console.log(`PROTOCOL_FEE: ${fee}`);
        console.log(`FEE_DENOMINATOR: ${denominator}`);
        console.log(`Fee Percentage: ${(Number(fee) * 100 / Number(denominator)).toFixed(2)}%`);
    } catch (err) {
        console.error('Error checking fee:', err);
    }
}

checkFee();
