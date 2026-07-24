// BY GOD'S GRACE ALONE
import { createPublicClient, createWalletClient, http, parseAbi, type PublicClient, type WalletClient, maxUint256, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import 'dotenv/config';

const ARB_SEPOLIA_RPC_URL = process.env.ARB_SEPOLIA_RPC_URL?.trim();
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY?.replace(/;/g, '').trim() as `0x${string}`;

const VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;
const VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;
const VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER = process.env.VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER?.replace(/;/g, '').trim() as `0x${string}`;

if (!KEEPER_PRIVATE_KEY || !VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER || !VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER || !ARB_SEPOLIA_RPC_URL) {
  throw new Error("Missing crucial multichain environment variables inside operational setup context.");
}

const RANGE_AI_USDC = "0x36BD22d795316C9FaE0e7E6193C3AdC6eC231B11".replace(/;/g, '').trim() as `0x${string}`;
const RANGE_AI_WETH = "0x8B76E900079A028639A57f23AcD71eFD3a0598a4".replace(/;/g, '').trim() as `0x${string}`;
const UNISWAP_V3_ROUTER_02 = "0x101F443B4d1b059569D643917553c771E1b9663E".replace(/;/g, '').trim() as `0x${string}`;

const vaultAbi = parseAbi([
  'function deposit(uint256 amount0Desired, uint256 amount1Desired) external returns (uint256 shares)'
]);

const erc20RangeAiAbi = parseAbi([
  'function mint(uint256 amountWithoutDecimals) external',
  'function approve(address spender, uint256 amount) external returns (bool)'
]);

const router02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut)'
]);

interface SetupConfig {
  chainName: string;
  vaultAddress: `0x${string}`;
  feeTier: number;
  publicClient: PublicClient<any, any>;
  walletClient: WalletClient<any, any, any>;
}

const account = privateKeyToAccount(KEEPER_PRIVATE_KEY);
const setupWorkers: SetupConfig[] = [
  {
    chainName: "1% Tier Pool Setup",
    vaultAddress: VAULT_ADDRESS_ARB_SEPOLIA_ONE_PERCENT_FEE_TIER,
    feeTier: 10000,
    publicClient: createPublicClient({ chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) })
  },
  {
    chainName: "0.3% Tier Pool Setup",
    vaultAddress: VAULT_ADDRESS_ARB_SEPOLIA_POINT_THREE_PERCENT_FEE_TIER,
    feeTier: 3000,
    publicClient: createPublicClient({ chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) })
  },
  {
    chainName: "0.05% Tier Pool Setup",
    vaultAddress: VAULT_ADDRESS_ARB_SEPOLIA_POINT_ZERO_FIVE_PERCENT_FEE_TIER,
    feeTier: 500,
    publicClient: createPublicClient({ chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: arbitrumSepolia, transport: http(ARB_SEPOLIA_RPC_URL) })
  }
];
async function executeOneTimePoolSetup() {
  console.log("=== Launching Isolated One-Time Sandbox Seeding Script ===");

  for (const worker of setupWorkers) {
    try {
      console.log(`\n[Setup: ${worker.chainName}] Querying current blockchain nonce...`);
      
      // FIX: Queries the base transaction index profile to manage explicit, incremental nonce sequences
      let nextNonce = await worker.publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending"
      });

      console.log(`[Setup: ${worker.chainName}] Base Nonce Initialized: ${nextNonce}. Minting tokens...`);

    //   for (const token of [RANGE_AI_USDC, RANGE_AI_WETH]) {
    //     const hash = await worker.walletClient.writeContract({
    //       chain: arbitrumSepolia,
    //       account,
    //       address: token,
    //       abi: erc20RangeAiAbi,
    //       functionName: 'mint',
    //       args: [1000000000000n],
    //       nonce: nextNonce++ // FIX: Manually increments the nonce property to clear tx: 161 lockouts
    //     });
    //     await worker.publicClient.waitForTransactionReceipt({ hash });
    //   }

      for (const token of [RANGE_AI_USDC, RANGE_AI_WETH]) {
        for (const spender of [worker.vaultAddress, UNISWAP_V3_ROUTER_02]) {
          const hash = await worker.walletClient.writeContract({
            chain: arbitrumSepolia,
            account,
            address: token,
            abi: erc20RangeAiAbi,
            functionName: 'approve',
            args: [spender, maxUint256],
            nonce: nextNonce++ // FIX: Keeps nonces sequential without waiting for block discovery lags
          });
          await worker.publicClient.waitForTransactionReceipt({ hash });
        }
      }

      const seedAmt0 = parseUnits("1645", 6); 
      const seedAmt1 = parseUnits("1", 18);    
      
      console.log(`[Setup: ${worker.chainName}] Submitting deposit using Nonce: ${nextNonce}...`);
      const depHash = await worker.walletClient.writeContract({
        chain: arbitrumSepolia,
        account,
        address: worker.vaultAddress,
        abi: vaultAbi,
        functionName: 'deposit',
        args: [seedAmt0, seedAmt1],
        nonce: nextNonce++
      });
      await worker.publicClient.waitForTransactionReceipt({ hash: depHash });
      console.log(`[Setup: ${worker.chainName}] Seeding achieved! Hash: ${depHash}`);

      const swapAmount0 = parseUnits("50", 6);
      console.log(`[Setup: ${worker.chainName}] Executing single swap using Nonce: ${nextNonce}...`);
      
      const swapHash = await worker.walletClient.writeContract({
        chain: arbitrumSepolia,
        account,
        address: UNISWAP_V3_ROUTER_02,
        abi: router02Abi,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: RANGE_AI_USDC,
          tokenOut: RANGE_AI_WETH,
          fee: worker.feeTier,
          recipient: account.address,
          amountIn: swapAmount0,
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n
        }],
        nonce: nextNonce++
      });
      await worker.publicClient.waitForTransactionReceipt({ hash: swapHash });
      console.log(`[Setup: ${worker.chainName}] Single Setup Swap Completed! Hash: ${swapHash}`);

    } catch (error) {
      console.error(`\n[Execution Failure on ${worker.chainName}]:`, error);
    }
  }

  console.log("\n=== Isolated Setup Phase Sequence Execution Complete ===");
  process.exit(0);
}

executeOneTimePoolSetup();
