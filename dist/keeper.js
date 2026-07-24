"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// BY GOD'S GRACE ALONE
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
require("dotenv/config");
// environment variables
const ETH_SEPOLIA_RPC_URL = process.env.ETH_SEPOLIA_RPC_URL?.trim();
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY?.replace(/;/g, '').trim();
const VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER?.replace(/;/g, '').trim();
const VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER?.replace(/;/g, '').trim();
const VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER?.replace(/;/g, '').trim();
const USDC_WETH_POOL_ETH_SEPOLIA_10000 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_10000?.replace(/;/g, '').trim();
const USDC_WETH_POOL_ETH_SEPOLIA_3000 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_3000?.replace(/;/g, '').trim();
const USDC_WETH_POOL_ETH_SEPOLIA_500 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_500?.replace(/;/g, '').trim();
if (!KEEPER_PRIVATE_KEY || !VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER || !ETH_SEPOLIA_RPC_URL) {
    throw new Error("Missing  environment variables.");
}
const USDC = process.env.USDC?.replace(/;/g, '').trim();
const WETH = process.env.WETH?.replace(/;/g, '').trim();
const UNISWAP_V3_ROUTER_02_ETH_SEP = process.env.UNISWAP_V3_ROUTER_02_ETH_SEP?.replace(/;/g, '').trim();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// abi definition structural interfaces
const vaultAbi = (0, viem_1.parseAbi)([
    'function tokenId() view returns (uint256)',
    'function tickLower() view returns (int24)',
    'function tickUpper() view returns (int24)',
    'function pool() view returns (address)',
    'function rebalance(int24 tickHalfWidth) external',
    'function deposit(uint256 amount0Desired, uint256 amount1Desired) external returns (uint256 shares)'
]);
const poolAbi = (0, viem_1.parseAbi)([
    'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)'
]);
const erc20RangeAiAbi = (0, viem_1.parseAbi)([
    'function mint(uint256 amountWithoutDecimals) external',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)'
]);
const router02Abi = (0, viem_1.parseAbi)([
    'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
    'function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut)'
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
 *
 * @dev core rebalancing triggering logic, to be automated in `startMultichainKeeperDaemon()` below
 */
async function inspectAndMaintainVaultRange(worker) {
    try {
        const [tickLower, tickUpper] = await Promise.all([
            worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickLower' }),
            worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickUpper' })
        ]);
        const slot0Data = await worker.publicClient.readContract({ address: worker.poolAddress, abi: poolAbi, functionName: 'slot0' });
        const currentTick = Number(slot0Data[1]);
        console.log(`[${worker.chainName}] Current pool tick: ${currentTick} | Position bounds: [${tickLower}, ${tickUpper}]`);
        if (tickLower === 0 && tickUpper === 0) {
            console.log(`[${worker.chainName}] Vault boundaries uninitialized. Skipping monitoring loop iteration.`);
            return;
        }
        if (currentTick <= tickLower || currentTick >= tickUpper) {
            console.warn(`[${worker.chainName}] ⚠️ Strategy range violation! Initiating contract rebalance...`);
            const tickHalfWidth = 20;
            const { request } = await worker.publicClient.simulateContract({
                account, address: worker.vaultAddress, abi: vaultAbi, functionName: 'rebalance', args: [tickHalfWidth]
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
/**
 * @dev the automating part, invoked at the very bottom: startMultichainKeeperDaemon();
 */
async function startMultichainKeeperDaemon() {
    console.log("=== activating rangebound ai keeper===");
    multichainWorkers.forEach((worker) => {
        // Stream 1: Listen for new blocks to review range alignments
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
