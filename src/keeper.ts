// BY GOD'S GRACE ALONE
import { createPublicClient, createWalletClient, http, parseAbi, type PublicClient, type WalletClient, } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { arbitrum, zksync } from "viem/chains"
import 'dotenv/config';

// 1. Structural Environment Verification Rules
const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || 'https://publicnode.com';
const ZKSYNC_RPC = process.env.ZKSYNC_RPC_URL || 'https://zksync.io';
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY as `0x${string}`;

const ARBITRUM_VAULT = process.env.ARBITRUM_VAULT_ADDRESS as `0x${string}`;
const ZKSYNC_VAULT = process.env.ZKSYNC_VAULT_ADDRESS as `0x${string}`;

if (!KEEPER_PRIVATE_KEY || !ARBITRUM_VAULT || !ZKSYNC_VAULT) {
    throw new Error("Missing crucial multichain environment variables inside operational setup context.");
}

// 2. High-Utility ABI Definition Structural Interfaces
const vaultAbi = parseAbi([
    'function tokenId() view returns (uint256)',
    'function tickLower() view returns (int24)',
    'function tickUpper() view returns (int24)',
    'function pool() view returns (address)',
    'function rebalance(int24 tickHalfWidth) external',
    'error AutoCLVault__Unauthorized()'
]);

const poolAbi = parseAbi([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
]);

// 3. Define Chain Worker Structure Mapping Contexts
interface ChainWorkerConfig {
  chainName: string;
  vaultAddress: `0x${string}`;
  // Use explicit 'any' generics to support heterogeneous chain clients in the same array
  publicClient: PublicClient<any, any>;
  walletClient: WalletClient<any, any, any>;
}

// Initialize shared cryptographic key parsing node
const account = privateKeyToAccount(KEEPER_PRIVATE_KEY);

// Construct our parallel worker array database matrix
const multichainWorkers: ChainWorkerConfig[] = [
    {
        chainName: "Arbitrum One Network Node",
        vaultAddress: ARBITRUM_VAULT,
        publicClient: createPublicClient({ chain: arbitrum, transport: http(ARBITRUM_RPC) }),
        walletClient: createWalletClient({ account, chain: arbitrum, transport: http(ARBITRUM_RPC) })
    },
    {
        chainName: "zkSync Era Mainnet Node",
        vaultAddress: ZKSYNC_VAULT,
        publicClient: createPublicClient({ chain: zksync, transport: http(ZKSYNC_RPC) }),
        walletClient: createWalletClient({ account, chain: zksync, transport: http(ZKSYNC_RPC) })
    }
];
/**
 * @notice The core evaluation module running dynamically to track target pool states
 * @param worker Target configuration node matrix tracking an active chain context
 */
async function inspectAndMaintainVaultRange(worker: ChainWorkerConfig) {
    console.log(`[${worker.chainName}] Checking active position metrics across boundaries...`);
    try {
        // 1. Fetch the vault's internal tracking configurations
        const [tickLower, tickUpper, poolAddress] = await Promise.all([
            worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickLower' }),
            worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickUpper' }),
            worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'pool' })
        ]);

        // 2. Fetch the current physical slot0 tick state from the Uniswap pool
        const slot0Data = await worker.publicClient.readContract({
            address: poolAddress,
            abi: poolAbi,
            functionName: 'slot0'
        });
        const currentTick = slot0Data[1];

        console.log(`[${worker.chainName}] Current pool tick: ${currentTick} | Position bounds: [${tickLower}, ${tickUpper}]`);

        // 3. Check if market spot prices have shifted outside our active boundaries
        if (currentTick <= tickLower || currentTick >= tickUpper) {
            console.log(`[${worker.chainName}] tickLower: `, tickLower);
            console.log(`[${worker.chainName}] tickUpper: `, tickUpper);
            console.warn(`[${worker.chainName}] ⚠️ Market price breach detected! Initiating vault rebalance...`);

            // Execute automated transaction routing 
            const tickHalfWidth = 20;

            const { request } = await worker.publicClient.simulateContract({
                account,
                address: worker.vaultAddress,
                abi: vaultAbi,
                functionName: 'rebalance',
                args: [tickHalfWidth]
            });

            const hash = await worker.walletClient.writeContract(request);
            console.log(`[${worker.chainName}] Rebalance execution achieved successfully! Tx hash: ${hash}`);

            const receipt = await worker.publicClient.waitForTransactionReceipt({ hash });
            console.log(`[${worker.chainName}] Block confirmation received in block index: ${receipt.blockNumber}`);
        } else {
            console.log(`[${worker.chainName}] Position boundaries remain optimal. Yield structures safe.`);
        }
    } catch (error) {
        console.error(`[${worker.chainName}] Execution error encountered in monitoring routing loop:`, error);
    }
}

/**
 * @notice Automated multichain daemon initializer
 */
function startMultichainKeeperDaemon() {
    console.log("=== RangeBound AI Multichain Strategy Engine Online ===");

    // Spawn concurrent watch streams across all registered workers
    multichainWorkers.forEach((worker) => {
        console.log(`[System Init] Booting background listener for ${worker.chainName} tracking: ${worker.vaultAddress}`);
        
        worker.publicClient.watchBlocks({
            onBlock: async (block) => {
                console.log(`\n[${worker.chainName}] New Block Inbound: #${block.number}`);
                await inspectAndMaintainVaultRange(worker);
            },
            onError: (error) => {
                console.error(`[${worker.chainName}] Block subscription drop detected:`, error);
            }
        });
    });
}

startMultichainKeeperDaemon();
