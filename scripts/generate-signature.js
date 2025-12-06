const { LocalAccountSigner } = require("@farcaster/core");
const { ViemLocalEip712Signer } = require("@farcaster/core");
const { generateDomainSignature } = require("@farcaster/core");
const { mnemonicToAccount } = require("viem/accounts");

async function main() {
    const mnemonic = process.env.FARCASTER_MNEMONIC;
    if (!mnemonic) {
        console.error("Please set FARCASTER_MNEMONIC environment variable");
        process.exit(1);
    }

    const account = mnemonicToAccount(mnemonic);
    // Note: This depends on how the user's account was created. 
    // Often it's an EIP-712 signer or just the account itself.
    // For domain verification, we usually sign with the App's custody address.

    const domain = "cast-predict.vercel.app";

    // This is a simplified example. The actual signing might require specific encoding.
    // However, the easiest way is often to use the Farcaster Developer Portal's "Domain Verification" tool
    // if available, or use a library that supports it.

    console.log("To generate the signature, please use the Farcaster Developer Portal or a trusted tool.");
    console.log("Domain:", domain);
    console.log("Account:", account.address);
}

main();
