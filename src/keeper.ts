// BY GOD'S GRACE ALONE
import { createPublicClient, createWalletClient, http, parseAbi, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import 'dotenv/config';

// environment variables
const ETH_SEPOLIA_RPC_URL = process.env.ETH_SEPOLIA_RPC_URL?.trim();
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY?.replace(/;/g, '').trim() as `0x${string}`;

const VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;
const VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;
const VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;

const USDC_WETH_POOL_ETH_SEPOLIA_10000 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_10000?.replace(/;/g, '').trim() as `0x${string}`;
const USDC_WETH_POOL_ETH_SEPOLIA_3000 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_3000?.replace(/;/g, '').trim() as `0x${string}`;
const USDC_WETH_POOL_ETH_SEPOLIA_500 = process.env.USDC_WETH_POOL_ETH_SEPOLIA_500?.replace(/;/g, '').trim() as `0x${string}`;

if (!KEEPER_PRIVATE_KEY || !VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER || !ETH_SEPOLIA_RPC_URL) {
  throw new Error("Missing  environment variables.");
}

const USDC = process.env.USDC?.replace(/;/g, '').trim() as `0x${string}`;
const WETH = process.env.WETH?.replace(/;/g, '').trim() as `0x${string}`;
const UNISWAP_V3_ROUTER_02_ETH_SEP = process.env.UNISWAP_V3_ROUTER_02_ETH_SEP?.replace(/;/g, '').trim() as `0x${string}`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// abi definition structural interfaces
const vaultAbi = parseAbi([
  'function tokenId() view returns (uint256)',
  'function tickLower() view returns (int24)',
  'function tickUpper() view returns (int24)',
  'function pool() view returns (address)',
  'function rebalance(int24 tickHalfWidth) external',
  'function deposit(uint256 amount0Desired, uint256 amount1Desired) external returns (uint256 shares)'
]);

const poolAbi = parseAbi([
  'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)'
]);

const erc20RangeAiAbi = parseAbi([
  'function mint(uint256 amountWithoutDecimals) external',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)'
]);

const router02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut)'
]);

interface ChainWorkerConfig {
  chainName: string;
  vaultAddress: `0x${string}`;
  poolAddress: `0x${string}`;
  feeTier: number;
  publicClient: PublicClient<any, any>;
  walletClient: WalletClient<any, any, any>;
}

const account = privateKeyToAccount(KEEPER_PRIVATE_KEY);
const multichainWorkers: ChainWorkerConfig[] = [
  {
    chainName: "Eth Sepolia USDC_WETH Vault Range AI [1%]",
    vaultAddress: VAULT_ADDRESS_ETH_SEPOLIA_ONE_PERCENT_FEE_TIER,
    poolAddress: USDC_WETH_POOL_ETH_SEPOLIA_10000,
    feeTier: 10000,
    publicClient: createPublicClient({ chain: sepolia, transport: http(ETH_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: sepolia, transport: http(ETH_SEPOLIA_RPC_URL) })
  },
  {
    chainName: "Eth Sepolia USDC_WETH Vault Range AI [0.3%]",
    vaultAddress: VAULT_ADDRESS_ETH_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER,
    poolAddress: USDC_WETH_POOL_ETH_SEPOLIA_3000,
    feeTier: 3000,
    publicClient: createPublicClient({ chain: sepolia, transport: http(ETH_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: sepolia, transport: http(ETH_SEPOLIA_RPC_URL) })
  },
  {
    chainName: "Eth Sepolia USDC_WETH Range AI Vault [0.05%]",
    vaultAddress: VAULT_ADDRESS_ETH_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER,
    poolAddress: USDC_WETH_POOL_ETH_SEPOLIA_500,
    feeTier: 500,
    publicClient: createPublicClient({ chain: sepolia, transport: http(ETH_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: sepolia, transport: http(ETH_SEPOLIA_RPC_URL) })
  },
];

/**
 * 
 * @dev core rebalancing triggering logic, to be automated in `startMultichainKeeperDaemon()` below
 */

async function inspectAndMaintainVaultRange(worker: ChainWorkerConfig) {
  try {
    const [tickLower, tickUpper] = await Promise.all([
      worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickLower' }),
      worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickUpper' })
    ]);

    const slot0Data = await worker.publicClient.readContract({ address: worker.poolAddress, abi: poolAbi, functionName: 'slot0' }) as readonly unknown[];
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
    } else {
      console.log(`[${worker.chainName}] Position ranges are healthy. Yield allocations safe.`);
    }
  } catch (error) {
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
