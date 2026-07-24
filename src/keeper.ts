// BY GOD'S GRACE ALONE
import { createPublicClient, createWalletClient, http, parseAbi, type PublicClient, type WalletClient, maxUint256, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import 'dotenv/config';

// 1. Structural Environment Verification Rules
const ARB_SEPOLIA_RPC_URL = process.env.ARB_SEPOLIA_RPC_URL?.trim();
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY?.replace(/;/g, '').trim() as `0x${string}`;

const VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;
const VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;
const VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;

const USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_10000 = process.env.USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_10000?.replace(/;/g, '').trim() as `0x${string}`;
const USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_3000 = process.env.USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_3000?.replace(/;/g, '').trim() as `0x${string}`;
const USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_500 = process.env.USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_500?.replace(/;/g, '').trim() as `0x${string}`;

if (!KEEPER_PRIVATE_KEY || !VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER || !ARB_SEPOLIA_RPC_URL) {
  throw new Error("Missing crucial multichain environment variables inside operational setup context.");
}

const RANGE_AI_USDC = "0x36BD22d795316C9FaE0e7E6193C3AdC6eC231B11".replace(/;/g, '').trim() as `0x${string}`;
const RANGE_AI_WETH = "0x8B76E900079A028639A57f23AcD71eFD3a0598a4".replace(/;/g, '').trim() as `0x${string}`;
const UNISWAP_V3_ROUTER_02 = "0x101F443B4d1b059569D643917553c771E1b9663E".replace(/;/g, '').trim() as `0x${string}`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// 2. High-Utility ABI Definition Structural Interfaces
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
    chainName: "Arbitrum Sepolia USDC_WETH Vault Range AI [1%]",
    vaultAddress: VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER,
    poolAddress: USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_10000,
    feeTier: 10000,
    publicClient: createPublicClient({ chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) })
  },
  {
    chainName: "Arbitrum Sepolia USDC_WETH Vault Range AI [0.3%]",
    vaultAddress: VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER,
    poolAddress: USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_3000,
    feeTier: 3000,
    publicClient: createPublicClient({ chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) })
  },
  {
    chainName: "Arbitrum Sepolia USDC_WETH Range AI Vault [0.05%]",
    vaultAddress: VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER,
    poolAddress: USDC_WETH_POOL_RANGE_AI_ARB_SEPOLIA_500,
    feeTier: 500,
    publicClient: createPublicClient({ chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) })
  },
];
/**
 * @notice Automated seeding engine that runs if vault storage bounds read [0, 0]
 * @dev Mints sandbox tokens and fires a deposit to bind the strategy securely around the spot price
 */
async function autoSeedVaultBoundariesIfUninitialized(worker: ChainWorkerConfig) {
  try {
    const [tickLower, tickUpper] = await Promise.all([
      worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickLower' }),
      worker.publicClient.readContract({ address: worker.vaultAddress, abi: vaultAbi, functionName: 'tickUpper' })
    ]);

    // System Check: Skip initialization step if vault values are already set
    if (tickLower !== 0 || tickUpper !== 0) return;

    console.log(`\n[Auto-Seeder] Detected uninitialized bounds [0, 0] on ${worker.chainName}`);
    console.log(`[Auto-Seeder] Preparing nominal balance minting parameters...`);

    const seedAmt0 = parseUnits("1000", 6);   // 1000 Sandbox USDC
    const seedAmt1 = parseUnits("0.5", 18);   // 0.5 Sandbox WETH

    // Step 1: Automated Faucet Minting for token0 & token1
    for (const token of [RANGE_AI_USDC, RANGE_AI_WETH]) {
      const { request: mintReq } = await worker.publicClient.simulateContract({
        account, address: token, abi: erc20RangeAiAbi, functionName: 'mint', args: [50000n]
      });
      const mintHash = await worker.walletClient.writeContract(mintReq);
      await worker.publicClient.waitForTransactionReceipt({ hash: mintHash });
    }
    console.log(`[Auto-Seeder] Faucet minting resolved. Assigning vault allowances...`);

    // Step 2: Grant standard ERC-20 spending allowances to the target vault address
    for (const token of [RANGE_AI_USDC, RANGE_AI_WETH]) {
      const { request: appReq } = await worker.publicClient.simulateContract({
        account, address: token, abi: erc20RangeAiAbi, functionName: 'approve', args: [worker.vaultAddress, maxUint256]
      });
      const appHash = await worker.walletClient.writeContract(appReq);
      await worker.publicClient.waitForTransactionReceipt({ hash: appHash });
    }

    // Step 3: Fire initial deposit to anchor strategy positions around the live tick
    console.log(`[Auto-Seeder] Submitting nominal funding deposit parameters to initialize bounds...`);
    const { request: depReq } = await worker.publicClient.simulateContract({
      account,
      address: worker.vaultAddress,
      abi: vaultAbi,
      functionName: 'deposit',
      args: [seedAmt0, seedAmt1]
    });

    const depHash = await worker.walletClient.writeContract(depReq);
    await worker.publicClient.waitForTransactionReceipt({ hash: depHash });
    console.log(`[Auto-Seeder] Seeding successful! Vault initialized. Tx Hash: ${depHash}`);
    await delay(2000);
  } catch (error) {
    console.error(`[Auto-Seeder Error] Failed to execute target vault initialization:`, error);
  }
}
// BY GOD'S GRACE ALONE
/**
 * @notice Self-sufficient asset engine that manages token creation and forces sandbox swaps
 * @dev Dynamic allocation routes trades directly through worker.feeTier to ensure pool matching structures
 */
async function executeSimulatedMarketVolatility(worker: ChainWorkerConfig, directionUp: boolean) {
  try {
    const tokenIn = directionUp ? RANGE_AI_USDC : RANGE_AI_WETH;
    const tokenOut = directionUp ? RANGE_AI_WETH : RANGE_AI_USDC;

    const currentBalance = await worker.publicClient.readContract({
      address: tokenIn, abi: erc20RangeAiAbi, functionName: 'balanceOf', args: [account.address]
    });

    if (currentBalance < parseUnits("10", directionUp ? 6 : 18)) {
      console.log(`[Volatility Engine] Minting sandbox tokens for: ${worker.chainName}...`);
      const mintAmount = directionUp ? 500000n : 5000n;
      const { request } = await worker.publicClient.simulateContract({
        account, address: tokenIn, abi: erc20RangeAiAbi, functionName: 'mint', args: [mintAmount]
      });
      const hash = await worker.walletClient.writeContract(request);
      await worker.publicClient.waitForTransactionReceipt({ hash });
      console.log(`[Volatility Engine] Mint successful! Tx Hash: ${hash}`);
      await delay(1000);
    }

    const routerAllowance = await worker.publicClient.readContract({
      address: tokenIn, abi: erc20RangeAiAbi, functionName: 'allowance', args: [account.address, UNISWAP_V3_ROUTER_02]
    });

    if (routerAllowance < maxUint256 / 2n) {
      console.log(`[Volatility Engine] Authorizing Router02 spend limits...`);
      const { request } = await worker.publicClient.simulateContract({
        account, address: tokenIn, abi: erc20RangeAiAbi, functionName: 'approve', args: [UNISWAP_V3_ROUTER_02, maxUint256]
      });
      const hash = await worker.walletClient.writeContract(request);
      await worker.publicClient.waitForTransactionReceipt({ hash });
      await delay(1000);
    }

    const swapAmount = directionUp ? parseUnits("500", 6) : parseUnits("0.2", 18);
    console.log(`[Volatility Engine] Sending live market order parameters to alter pool positions...`);

    // FIX: Replaced static fee mapping with worker.feeTier to match specific pool routing structures
    const { request: swapRequest } = await worker.publicClient.simulateContract({
      account,
      address: UNISWAP_V3_ROUTER_02,
      abi: router02Abi,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn,
        tokenOut,
        fee: worker.feeTier, 
        recipient: account.address,
        amountIn: swapAmount,
        amountOutMinimum: 0n, 
        sqrtPriceLimitX96: 0n
      }]
    });

    const swapHash = await worker.walletClient.writeContract(swapRequest);
    console.log(`[Volatility Engine] Volatility swap completed successfully! Tx Hash: ${swapHash}`);
  } catch (error) {
    console.error(`[Volatility Engine Error] Swap execution faulted on Router02 for ${worker.chainName}:`, error);
  }
}


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
async function startMultichainKeeperDaemon() {
  console.log("=== RangeBound AI Multichain Strategy Engine Online ===");
  console.log("[Bootstrap] Executing pre-flight checks and seeding sequences...");

  // Run the seeding logic sequentially across workers before starting live watchers
  for (const worker of multichainWorkers) {
    await autoSeedVaultBoundariesIfUninitialized(worker);
  }

  console.log("[Bootstrap] Verification complete. Booting active listeners.");
  let swapToggleDirection = true;

  multichainWorkers.forEach((worker) => {
    // Stream 1: Listen for new blocks to review range alignments
    worker.publicClient.watchBlocks({
      onBlock: async (block) => {
        console.log(`\n[${worker.chainName}] New Block Inbound: #${block.number}`);
        await inspectAndMaintainVaultRange(worker);
      },
      onError: (error) => console.error(`[${worker.chainName}] Subscription connection drop:`, error)
    });

    // Stream 2: Interval swaps running every 3 minutes to simulate price movement safely
    setInterval(async () => {
      console.log(`\n[Timer Trigger] Submitting trades to shift ticks for ${worker.chainName}...`);
      await executeSimulatedMarketVolatility(worker, swapToggleDirection);
      swapToggleDirection = !swapToggleDirection;
    }, 10000);
  });
}

startMultichainKeeperDaemon();
