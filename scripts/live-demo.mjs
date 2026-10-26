import { readFileSync, statSync } from 'node:fs';
import { createPublicClient, createWalletClient, defineChain, erc20Abi, formatEther, formatUnits, getAddress, http, keccak256, parseAbi, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Small, fixed Mezo TESTNET smoke trade. The local wallet files are ignored by Git.
if (process.argv[2] !== '--execute-testnet-trade' || process.argv.length !== 3) {
  console.log('Review this script before running. It approves 100 MUSD, fills a buyer-restricted offer for 0.001 testnet BTC, and cancels a separate nonce.');
  console.log('To submit those Mezo testnet transactions explicitly, run: node scripts/live-demo.mjs --execute-testnet-trade');
  process.exit(0);
}
const rpc = process.env.MATCH_RPC_URL || 'https://rpc.test.mezo.org';
const chain = defineChain({ id: 31611, name: 'Mezo testnet', nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 }, rpcUrls: { default: { http: [rpc] } }, testnet: true });
const settlement = getAddress('0x6316796dC8D2014405003e09d3aD0CeB51987c33');
const token = getAddress('0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503');
const codehash = '0x9a29cf7c56af4171a54f3265b856d540a42f909bc1e491b758e6bfbca4b54132';
const abi = parseAbi([
  'function musd() view returns (address)',
  'function nonceUsed(address maker, uint256 nonce) view returns (bool)',
  'function isValidSignature((address maker,address taker,uint256 musdAmount,uint256 btcAmount,uint256 expiry,uint256 nonce) offer,bytes signature) view returns (bool)',
  'function fill((address maker,address taker,uint256 musdAmount,uint256 btcAmount,uint256 expiry,uint256 nonce) offer,bytes signature) payable',
  'function cancel(uint256 nonce)',
  'event Filled(bytes32 indexed digest,address indexed maker,address indexed taker,uint256 nonce,uint256 musdAmount,uint256 btcAmount)',
]);
const types = { Offer: [
  { name: 'maker', type: 'address' }, { name: 'taker', type: 'address' },
  { name: 'musdAmount', type: 'uint256' }, { name: 'btcAmount', type: 'uint256' },
  { name: 'expiry', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
] };
function localAccount(name, expected) {
  const file = new URL(`../.secrets/${name}`, import.meta.url);
  if ((statSync(file).mode & 0o077) !== 0) throw new Error(`Restrict ${name} to mode 600.`);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  const account = privateKeyToAccount(saved.privateKey);
  if (saved.chainId !== 31611 || account.address !== getAddress(expected) || getAddress(saved.address) !== account.address) throw new Error(`Unexpected ${name} identity or chain.`);
  return account;
}
const seller = localAccount('mezo-testnet-wallet.json', '0x486bCc5E0FFc6b1Dc9Ed9E236Dd6bA9e5Fd991a0');
const buyer = localAccount('mezo-testnet-buyer.json', '0x8d22d5cB85b88aC8DCE60C5DCea3Afae5230E961');
const transport = http(rpc, { timeout: 20000, retryCount: 1 });
const publicClient = createPublicClient({ chain, transport });
const sellerClient = createWalletClient({ account: seller, chain, transport });
const buyerClient = createWalletClient({ account: buyer, chain, transport });
const musdAmount = parseEther('100');
const btcAmount = parseEther('0.001');
const explorer = hash => `https://explorer.test.mezo.org/tx/${hash}`;
const balanceOf = address => publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] });

async function receipt(hash) {
  console.log(`Broadcast ${explorer(hash)}`);
  const result = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120000, pollingInterval: 3000 });
  if (result.status !== 'success') throw new Error(`Reverted: ${explorer(hash)}`);
  console.log(`Confirmed block ${result.blockNumber}`);
  return result;
}

try {
  if (await publicClient.getChainId() !== 31611) throw new Error('RPC is not Mezo testnet.');
  const code = await publicClient.getCode({ address: settlement });
  if (!code || keccak256(code).toLowerCase() !== codehash) throw new Error('Unexpected settlement bytecode.');
  const [onchainToken, decimals, symbol, sellerMUSD, buyerBTC] = await Promise.all([
    publicClient.readContract({ address: settlement, abi, functionName: 'musd' }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
    balanceOf(seller.address), publicClient.getBalance({ address: buyer.address }),
  ]);
  if (getAddress(onchainToken) !== token || decimals !== 18 || symbol !== 'MUSD') throw new Error('Unexpected token.');
  if (sellerMUSD < musdAmount || buyerBTC <= btcAmount + parseEther('0.0001')) throw new Error('Insufficient assets for fixed test and gas.');
  console.log(`Mezo testnet: seller ${seller.address}, buyer ${buyer.address}`);
  console.log(`Fixed trade: ${formatUnits(musdAmount, 18)} MUSD for ${formatEther(btcAmount)} testnet BTC`);

  const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [seller.address, settlement] });
  if (allowance < musdAmount) {
    const { request } = await publicClient.simulateContract({ account: seller.address, address: token, abi: erc20Abi, functionName: 'approve', args: [settlement, musdAmount] });
    console.log('Approving exactly 100 MUSD...');
    await receipt(await sellerClient.writeContract({ ...request, account: seller, gas: 100_000n }));
  }
  if (await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [seller.address, settlement] }) < musdAmount) throw new Error('Approval missing.');

  const nonce = BigInt('0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'));
  const offer = { maker: seller.address, taker: buyer.address, musdAmount, btcAmount, expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), nonce };
  const signature = await sellerClient.signTypedData({ account: seller, domain: { name: 'MUSD Match', version: '1', chainId: 31611, verifyingContract: settlement }, types, primaryType: 'Offer', message: offer });
  if (!await publicClient.readContract({ address: settlement, abi, functionName: 'isValidSignature', args: [offer, signature] })) throw new Error('Signed offer rejected by the deployed contract.');
  const before = await Promise.all([balanceOf(seller.address), balanceOf(buyer.address), publicClient.getBalance({ address: seller.address })]);
  const { request } = await publicClient.simulateContract({ account: buyer.address, address: settlement, abi, functionName: 'fill', args: [offer, signature], value: btcAmount });
  console.log('Filling buyer restricted signed offer...');
  const fillReceipt = await receipt(await buyerClient.writeContract({ ...request, account: buyer, gas: 350_000n }));
  const after = await Promise.all([balanceOf(seller.address), balanceOf(buyer.address), publicClient.getBalance({ address: seller.address })]);
  const used = await publicClient.readContract({ address: settlement, abi, functionName: 'nonceUsed', args: [seller.address, nonce] });
  if (before[0] - after[0] !== musdAmount || after[1] - before[1] !== musdAmount || after[2] - before[2] !== btcAmount || !used) throw new Error('Fill confirmed but balance deltas or nonce differ; inspect the transaction.');
  console.log(`LIVE FILL VERIFIED ${explorer(fillReceipt.transactionHash)}`);
  console.log(`Buyer received ${formatUnits(after[1] - before[1], 18)} MUSD; seller received ${formatEther(after[2] - before[2])} BTC; nonce consumed.`);

  const cancelNonce = BigInt('0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'));
  const { request: cancelRequest } = await publicClient.simulateContract({ account: seller.address, address: settlement, abi, functionName: 'cancel', args: [cancelNonce] });
  console.log('Cancelling a separate offer nonce...');
  const cancelReceipt = await receipt(await sellerClient.writeContract({ ...cancelRequest, account: seller, gas: 100_000n }));
  if (!await publicClient.readContract({ address: settlement, abi, functionName: 'nonceUsed', args: [seller.address, cancelNonce] })) throw new Error('Cancellation nonce did not update.');
  console.log(`CANCELLATION VERIFIED ${explorer(cancelReceipt.transactionHash)}`);
} catch (error) {
  if (error instanceof Error) {
    console.error(error.shortMessage || error.message);
    if (error.details) console.error(`RPC details: ${error.details}`);
    if (error.cause?.details) console.error(`RPC cause: ${error.cause.details}`);
  } else console.error('Unknown error.');
  process.exitCode = 1;
}
