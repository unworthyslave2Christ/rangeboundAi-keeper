"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Rebalance Engine — Aligned Keeper Script
// BY GOD'S GRACE ALONE
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
require("dotenv/config");
const ETH_SEPOLIA_RPC_URL = process.env.ETH_SEPOLIA_RPC_URL?.trim();
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY?.replace(/;/g, '').trim();
const VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER?.replace(/;/g, '').trim();
const VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER?.replace(/;/g, '').trim();
const VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER?.replace(/;/g, '').trim();
const USDC_WETH_POOL_ETH_SEPOLIA_10000 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_10000?.replace(/;/g, '').trim();
const USDC_WETH_POOL_ETH_SEPOLIA_3000 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_3000?.replace(/;/g, '').trim();
const USDC_WETH_POOL_ETH_SEPOLIA_500 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_500?.replace(/;/g, '').trim();
if (!KEEPER_PRIVATE_KEY || !VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER || !ETH_SEPOLIA_RPC_URL) {
    throw new Error("Missing environment variables.");
}
const vaultAbi = (0, viem_1.parseAbi)([
    'function tokenId() view returns (uint256)',
    'function tickLower() view returns (int24)',
    'function tickUpper() view returns (int24)',
    'function pool() view returns (address)',
    'function rebalance(int24 tickHalfWidth) external',
    'function deposit(uint256 amount0Desired, uint256 amount1Desired) external returns (uint256 shares)'
]);
// ADDED: Uniswap V3 observe function to parse oracle historical states
const poolAbi = (0, viem_1.parseAbi)([
    'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
    'function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)'
]);
const account = (0, accounts_1.privateKeyToAccount)(KEEPER_PRIVATE_KEY);
const multichainWorkers = [
    {
        chainName: "Eth Sepolia USDC_WETH Vault Range AI [1%]",
        vaultAddress: VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER,
        poolAddress: USDC_WETH_POOL_ETH_SEPOLIA_10000,
        feeTier: 10000,
        publicClient: (0, viem_1.createPublicClient)({ chain: chains_1.sepolia, transport: (0, viem_1.http)(ETH_SEPOLIA_RPC_URL) }),
        walletClient: (0, viem_1.createWalletClient)({ account, chain: chains_1.sepolia, transport: (0, viem_1.http)(ETH_SEPOLIA_RPC_URL) })
    },
    {
        chainName: "Eth Sepolia USDC_WETH Vault Range AI [0.3%]",
        vaultAddress: VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER,
        poolAddress: USDC_WETH_POOL_ETH_SEPOLIA_3000,
        feeTier: 3000,
        publicClient: (0, viem_1.createPublicClient)({ chain: chains_1.sepolia, transport: (0, viem_1.http)(ETH_SEPOLIA_RPC_URL) }),
        walletClient: (0, viem_1.createWalletClient)({ account, chain: chains_1.sepolia, transport: (0, viem_1.http)(ETH_SEPOLIA_RPC_URL) })
    },
    {
        chainName: "Eth Sepolia USDC_WETH Range AI Vault [0.05%]",
        vaultAddress: VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER,
        poolAddress: USDC_WETH_POOL_ETH_SEPOLIA_500,
        feeTier: 500,
        publicClient: (0, viem_1.createPublicClient)({ chain: chains_1.sepolia, transport: (0, viem_1.http)(ETH_SEPOLIA_RPC_URL) }),
        walletClient: (0, viem_1.createWalletClient)({ account, chain: chains_1.sepolia, transport: (0, viem_1.http)(ETH_SEPOLIA_RPC_URL) })
    },
];
/**
 * @dev Helper to fetch and match the smart contract's exact 5-minute internal TWAP tick calculation
 */
async function getUniswapV3TwapTick(worker, secondsAgo) {
    const secondsAgos = [secondsAgo, 0];
    const [tickCumulatives] = await worker.publicClient.readContract({
        address: worker.poolAddress,
        abi: poolAbi,
        functionName: 'observe',
        args: [secondsAgos]
    });
    const tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
    // Perform JS integer division simulating Solidity truncation behavior
    let twapTick = Number(tickCumulativesDelta / BigInt(secondsAgo));
    // Correct truncation behavior for negative values in Solidity integer division
    if (tickCumulativesDelta < 0n && (tickCumulativesDelta % BigInt(secondsAgo) !== 0n)) {
        twapTick--;
    }
    return twapTick;
}
async function inspectAndMaintainVaultRange(worker) {
    try {
        const [tickLower, tickUpper] = await Promise.all([
            worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickLower' }),
            worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickUpper' })
        ]);
        // ALIGNED: Querying the identical 300-second TWAP tick calculated in Solidity
        const currentTwapTick = await getUniswapV3TwapTick(worker, 300);
        console.log(`[${worker.chainName}] Current 5-Min TWAP Tick: ${currentTwapTick} | Position bounds: [${tickLower}, ${tickUpper}]`);
        // if (tickLower === 0 && tickUpper === 0) {
        //     console.log(`[${worker.chainName}] Vault boundaries uninitialized. Skipping monitoring loop iteration.`);
        //     return;
        // }
        // Evaluation is now accurately evaluating TWAP price movements, avoiding spot spikes
        if (currentTwapTick <= tickLower || currentTwapTick >= tickUpper) {
            console.warn(`[${worker.chainName}] ⚠️ Strategy range violation detected by TWAP! Initiating contract rebalance...`);
            const tickHalfWidth = 20;
            const { request } = await worker.publicClient.simulateContract({
                account,
                address: worker.vaultAddress,
                abi: vaultAbi,
                functionName: 'rebalance',
                args: [tickHalfWidth]
            });
            const hash = await worker.walletClient.writeContract(request);
            console.log(`[${worker.chainName}] Rebalance transaction achieved! Tx Hash: ${hash}`);
            await worker.publicClient.waitForTransactionReceipt({ hash });
        }
        else {
            console.log(`[${worker.chainName}] Position ranges are healthy. Yield allocations safe.`);
        }
    }
    catch (error) {
        console.error(`[${worker.chainName}] Maintenance parsing execution failed:`, error);
    }
}
async function startMultichainKeeperDaemon() {
    console.log("=== activating rangebound ai keeper ===");
    multichainWorkers.forEach((worker) => {
        worker.publicClient.watchBlocks({
            onBlock: async (block) => {
                console.log(`\n[${worker.chainName}] New Block Inbound: #${block.number}`);
                await inspectAndMaintainVaultRange(worker);
            },
            onError: (error) => console.error(`[${worker.chainName}] Subscription connection drop:`, error)
        });
    });
}
startMultichainKeeperDaemon();
