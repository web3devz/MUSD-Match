import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, defineChain, encodeDeployData, erc20Abi, formatEther, getAddress, http, keccak256, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const rpc = process.env.MATCH_RPC_URL || 'https://rpc.test.mezo.org';
const chain = defineChain({ id: 31611, name: 'Mezo testnet', nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 }, rpcUrls: { default: { http: [rpc] } }, testnet: true });
const token = getAddress('0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503');
const walletPath = new URL('../.secrets/mezo-testnet-wallet.json', import.meta.url);
const statePath = new URL('../.secrets/deployment.json', import.meta.url);
const envPath = new URL('../.env.local', import.meta.url);
const artifactPath = new URL('../contracts/out/MUSDMatch.sol/MUSDMatch.json', import.meta.url);

try {
  if ((statSync(walletPath).mode & 0o077) !== 0) throw new Error('Wallet file is accessible to other local users. Restrict it to mode 600 first.');
  const saved = JSON.parse(readFileSync(walletPath, 'utf8'));
  const account = privateKeyToAccount(saved.privateKey);
  if (saved.chainId !== chain.id || account.address !== saved.address) throw new Error('Wallet identity or chain ID does not match the saved wallet.');
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const bytecode = artifact.bytecode.object;
  if (!/^0x[0-9a-f]+$/i.test(bytecode)) throw new Error('Compile the contract with forge build first.');
  const publicClient = createPublicClient({ chain, transport: http(rpc, { timeout: 15000, retryCount: 1 }) });
  if (await publicClient.getChainId() !== chain.id) throw new Error('RPC is not Mezo testnet (31611). Refusing to deploy.');
  if (!await publicClient.getCode({ address: token })) throw new Error('MUSD token code is missing on this RPC.');
  const [decimals, symbol] = await Promise.all([
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
  ]);
  if (decimals !== 18 || symbol !== 'MUSD') throw new Error('Unexpected MUSD token metadata. Refusing to deploy.');

  let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : undefined;
  if (state && (state.chainId !== chain.id || state.deployer !== account.address || !/^0x[0-9a-fA-F]{64}$/.test(state.hash))) throw new Error('Existing deployment record is inconsistent. Review it manually.');
  if (!state) {
    const balance = await publicClient.getBalance({ address: account.address });
    const data = encodeDeployData({ abi: artifact.abi, bytecode, args: [token] });
    const [estimatedGas, fees] = await Promise.all([
      publicClient.estimateGas({ account: account.address, data }),
      publicClient.estimateFeesPerGas(),
    ]);
    const gas = estimatedGas * 125n / 100n;
    const ceiling = gas * (fees.maxFeePerGas || fees.gasPrice || 0n);
    if (balance <= ceiling || ceiling === 0n) throw new Error(`Insufficient or unverified BTC for gas. Balance: ${formatEther(balance)} BTC; estimated ceiling: ${formatEther(ceiling)} BTC.`);
    console.log(`Mezo testnet, deployer ${account.address}, balance ${formatEther(balance)} BTC. Broadcasting one deployment...`);
    const walletClient = createWalletClient({ account, chain, transport: http(rpc, { timeout: 15000, retryCount: 1 }) });
    const hash = await walletClient.deployContract({ abi: artifact.abi, bytecode, args: [token], gas });
    state = { chainId: chain.id, deployer: account.address, hash };
    writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Broadcast: ${hash}. Transaction recorded locally; rerun this script to resume receipt verification.`);
  } else {
    console.log(`Resuming recorded deployment ${state.hash}; no new transaction will be sent.`);
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: state.hash, confirmations: 1, timeout: 120000, pollingInterval: 3000 });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`Deployment failed on chain. Inspect https://explorer.test.mezo.org/tx/${state.hash}`);
  const settlement = getAddress(receipt.contractAddress);
  const code = await publicClient.getCode({ address: settlement });
  if (!code) throw new Error('No runtime code at deployed address.');
  const onchainToken = await publicClient.readContract({ address: settlement, abi: parseAbi(['function musd() view returns (address)']), functionName: 'musd' });
  if (getAddress(onchainToken) !== token) throw new Error('Deployed contract references the wrong token.');
  const env = `VITE_SETTLEMENT_ADDRESS=${settlement}\nVITE_SETTLEMENT_CODEHASH=${keccak256(code)}\nVITE_MEZO_RPC_URL=${rpc}\n`;
  if (existsSync(envPath) && readFileSync(envPath, 'utf8') !== env) throw new Error('Existing .env.local differs. Compare it manually; it was not overwritten.');
  if (!existsSync(envPath)) writeFileSync(envPath, env, { flag: 'wx', mode: 0o600 });
  console.log(`Verified deployment ${settlement}`);
  console.log(`Explorer: https://explorer.test.mezo.org/tx/${state.hash}`);
  console.log('Saved .env.local. Independently compare the deployed source and constructor argument in the explorer before any trade.');
} catch (error) {
  console.error(error instanceof Error ? error.shortMessage || error.message : error);
  process.exitCode = 1;
}
