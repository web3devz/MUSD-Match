import { createPublicClient, createWalletClient, custom, defineChain, erc20Abi, getAddress, http, isAddress, keccak256, parseAbi, type Address, type Hex, type EIP1193Provider } from 'viem';
import { CHAIN_ID, MUSD, offerTypes, validateOffer, type Offer, type SignedOffer } from './offers';

export const chain = defineChain({ id: CHAIN_ID, name: 'Mezo testnet', nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.test.mezo.org'] } }, blockExplorers: { default: { name: 'Mezo explorer', url: 'https://explorer.test.mezo.org' } }, testnet: true });
export const abi = parseAbi([
  'function musd() view returns (address)',
  'function nonceUsed(address maker, uint256 nonce) view returns (bool)',
  'function isValidSignature((address maker, address taker, uint256 musdAmount, uint256 btcAmount, uint256 expiry, uint256 nonce) offer, bytes signature) view returns (bool)',
  'function fill((address maker, address taker, uint256 musdAmount, uint256 btcAmount, uint256 expiry, uint256 nonce) offer, bytes signature) payable',
  'function cancel(uint256 nonce)',
  'error InvalidToken()', 'error InvalidOffer()', 'error Expired()', 'error NonceUnavailable()', 'error WrongTaker()', 'error WrongValue()', 'error InvalidSignature()', 'error TokenTransferFailed()', 'error InexactTransfer()', 'error NativeTransferFailed()', 'error ReentrantCall()',
]);
// Confirmed Mezo testnet deployment; environment values can select another verified deployment.
const rawAddress = import.meta.env.VITE_SETTLEMENT_ADDRESS || '0x6316796dC8D2014405003e09d3aD0CeB51987c33';
export const settlement = isAddress(rawAddress) ? getAddress(rawAddress) : undefined;
const expectedCodehash = import.meta.env.VITE_SETTLEMENT_CODEHASH || '0x9a29cf7c56af4171a54f3265b856d540a42f909bc1e491b758e6bfbca4b54132';
export const configured = !!settlement && /^0x[0-9a-fA-F]{64}$/.test(expectedCodehash);
export const publicClient = createPublicClient({ chain, transport: http(import.meta.env.VITE_MEZO_RPC_URL || chain.rpcUrls.default.http[0], { timeout: 12000, retryCount: 1 }) });
export const domain = () => ({ name: 'MUSD Match', version: '1', chainId: CHAIN_ID, verifyingContract: settlement! });
export function provider(): EIP1193Provider {
  const p = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!p) throw new Error('No EVM wallet found. Install or open a supported wallet.');
  return p;
}
export async function wallet() {
  const client = createWalletClient({ chain, transport: custom(provider()) });
  if (await client.getChainId() !== CHAIN_ID) throw new Error('Switch your wallet to Mezo testnet before continuing.');
  const [account] = await client.getAddresses();
  if (!account) throw new Error('Connect your wallet first.');
  return { client, account };
}
export async function verifyDeployment() {
  if (!configured || !settlement) throw new Error('No verified settlement deployment is configured. Trading is disabled.');
  if (await publicClient.getChainId() !== CHAIN_ID) throw new Error('RPC returned an unexpected chain. Trading is disabled.');
  const code = await publicClient.getCode({ address: settlement });
  if (!code || keccak256(code).toLowerCase() !== expectedCodehash.toLowerCase()) throw new Error('Settlement bytecode does not match the configured deployment.');
  const [token, decimals, symbol] = await Promise.all([
    publicClient.readContract({ address: settlement, abi, functionName: 'musd' }),
    publicClient.readContract({ address: MUSD, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: MUSD, abi: erc20Abi, functionName: 'symbol' }),
  ]);
  if (getAddress(token) !== getAddress(MUSD) || decimals !== 18 || symbol !== 'MUSD') throw new Error('Unexpected MUSD deployment or token metadata.');
}
export async function availability(signed: SignedOffer) {
  validateOffer(signed.offer);
  if (!settlement || signed.chainId !== CHAIN_ID || getAddress(signed.settlement) !== settlement) throw new Error('Wrong deployment.');
  const [used, signatureValid, balance, allowance] = await Promise.all([
    publicClient.readContract({ address: settlement, abi, functionName: 'nonceUsed', args: [signed.offer.maker, signed.offer.nonce] }),
    publicClient.readContract({ address: settlement, abi, functionName: 'isValidSignature', args: [signed.offer, signed.signature] }),
    publicClient.readContract({ address: MUSD, abi: erc20Abi, functionName: 'balanceOf', args: [signed.offer.maker] }),
    publicClient.readContract({ address: MUSD, abi: erc20Abi, functionName: 'allowance', args: [signed.offer.maker, settlement] }),
  ]);
  if (used) throw new Error('This nonce has been filled or cancelled.');
  if (!signatureValid) throw new Error('The seller signature is invalid.');
  if (balance < signed.offer.musdAmount) throw new Error('Seller no longer has enough MUSD.');
  if (allowance < signed.offer.musdAmount) throw new Error('Seller must approve the exact MUSD amount before this offer is fillable.');
}
export async function sign(offer: Offer): Promise<SignedOffer> {
  await verifyDeployment();
  validateOffer(offer);
  const { client, account } = await wallet();
  if (getAddress(account) !== getAddress(offer.maker)) throw new Error('Wallet account changed. Reconnect and retry.');
  const signature = await client.signTypedData({ account, domain: domain(), types: offerTypes, primaryType: 'Offer', message: offer });
  return { version: 1, chainId: CHAIN_ID, settlement: settlement!, offer, signature };
}
export async function approve(signed: SignedOffer) {
  await verifyDeployment();
  validateOffer(signed.offer);
  const { client, account } = await wallet();
  if (getAddress(account) !== getAddress(signed.offer.maker)) throw new Error('Only the maker can approve their MUSD.');
  const { request } = await publicClient.simulateContract({ account, address: MUSD, abi: erc20Abi, functionName: 'approve', args: [settlement!, signed.offer.musdAmount] });
  return client.writeContract(request);
}
export async function fill(signed: SignedOffer) {
  await verifyDeployment();
  await availability(signed);
  const { client, account } = await wallet();
  const { request } = await publicClient.simulateContract({ account, address: settlement!, abi, functionName: 'fill', args: [signed.offer, signed.signature], value: signed.offer.btcAmount });
  return client.writeContract(request);
}
export async function cancel(signed: SignedOffer) {
  await verifyDeployment();
  const { client, account } = await wallet();
  if (getAddress(account) !== getAddress(signed.offer.maker)) throw new Error('Only the maker can cancel this offer.');
  const { request } = await publicClient.simulateContract({ account, address: settlement!, abi, functionName: 'cancel', args: [signed.offer.nonce] });
  return client.writeContract(request);
}
export async function receipt(hash: Hex) {
  const result = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120000, pollingInterval: 2500 });
  if (result.status !== 'success') throw new Error('The transaction reverted on chain. Inspect its explorer receipt.');
  return result;
}
export function explain(error: unknown): string {
  const e = error as { shortMessage?: string; message?: string; code?: number };
  if (e.code === 4001) return 'Request declined in your wallet. Nothing further was sent.';
  return (e.shortMessage || e.message || 'Unable to complete the request. Please retry.').slice(0, 500);
}
