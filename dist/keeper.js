"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// BY GOD'S GRACE ALONE
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
require("dotenv/config");
const RPC_URL = process.env.RPC_URL || 'https://sepolia.infura.io';
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
if (!KEEPER_PRIVATE_KEY || !VAULT_ADDRESS) {
    throw new Error("Missing crucial environment variables");
}
const vaultAbi = (0, viem_1.parseAbi)([
    'function tokenId() view returns (uint256)',
    'function tickLower() view returns (int24)',
    'function tickUpper() view returns (int24)',
    'function pool() view returns (address)',
    'function rebalance(int24 tickHalfWidth) external',
    'error AutoCLVault__Unauthorized()'
]);
const poolAbi = (0, viem_1.parseAbi)([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
]);
// initializing web3 clients
const publicClient = (0, viem_1.createPublicClient)({
    chain: chains_1.sepolia,
    transport: (0, viem_1.http)(RPC_URL)
});
const account = (0, accounts_1.privateKeyToAccount)(KEEPER_PRIVATE_KEY);
const walletClient = (0, viem_1.createWalletClient)({
    account,
    chain: chains_1.sepolia,
    transport: (0, viem_1.http)(RPC_URL)
});
/**
 * @notice the core evaluation module running every block to track pool states
 */
async function inspectAndMaintainVaultRange() {
    console.log("Checking active position metrics across boundaries...");
    try {
        // fetching the vault's internal tracking configurations
        const [tickLower, tickUpper, poolAddress] = await Promise.all([
            publicClient.readContract({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'tickLower' }),
            publicClient.readContract({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'tickUpper' }),
            publicClient.readContract({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'pool' })
        ]);
        // fetching the current physical slot0 tick state from the Uniswap pool
        const slot0Data = await publicClient.readContract({
            address: poolAddress,
            abi: poolAbi,
            functionName: 'slot0'
        });
        const currentTick = slot0Data[1];
        console.log(`Current pool tick: ${currentTick} | Position bounds: [${tickLower}, ${tickUpper}]`);
        // checking if market spot prices have shifted outside our active boundaries
        if (currentTick <= tickLower || currentTick >= tickUpper) {
            console.log("tickLower: ", tickLower);
            console.log("tickUpper: ", tickUpper);
            console.warn("⚠️ Market price breach detected! Initiating vault rebalance...");
            // executing automated transaction routing
            // setting targeted width multiplier parameters (e.g. width of 20 spaces)
            const tickHalfWidth = 20;
            const { request } = await publicClient.simulateContract({
                account,
                address: VAULT_ADDRESS,
                abi: vaultAbi,
                functionName: 'rebalance',
                args: [tickHalfWidth]
            });
            const hash = await walletClient.writeContract(request);
            console.log(`Rebalance execution achieved successfully! Tx hash: ${hash}`);
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log(`Block confirmation received in block index: ${receipt.blockNumber}`);
        }
        else {
            console.log("Position boundaries remain optimal. Yield structures safe.");
        }
    }
    catch (error) {
        console.error("Execution error encountered in monitoring routing loop:", error);
    }
}
/**
 * @notice automated daemon initializer
 */
function startKeeperDaemon() {
    console.log(`RangeBound AI Automation Engine Online. Monitoring Vault at: ${VAULT_ADDRESS}`);
    // Poll current states on every new finalized block arrival
    publicClient.watchBlocks({
        onBlock: async (block) => {
            console.log(`\n New Block Inbound: #${block.number}`);
            await inspectAndMaintainVaultRange();
        }
    });
}
startKeeperDaemon();
