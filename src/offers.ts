import { getAddress, isAddress, parseUnits, formatUnits, zeroAddress, type Address, type Hex } from 'viem';

export const CHAIN_ID = 31611;
export const MUSD = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as Address;
export type Offer = { maker: Address; taker: Address; musdAmount: bigint; btcAmount: bigint; expiry: bigint; nonce: bigint };
export type SignedOffer = { version: 1; chainId: number; settlement: Address; offer: Offer; signature: Hex };
export const offerTypes = { Offer: [
  { name: 'maker', type: 'address' }, { name: 'taker', type: 'address' },
  { name: 'musdAmount', type: 'uint256' }, { name: 'btcAmount', type: 'uint256' },
  { name: 'expiry', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
] } as const;
export function amount(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value) || value.length > 80) throw new Error('Enter a positive amount with at most 18 decimals.');
  const n = parseUnits(value, 18);
  if (n <= 0n || n >= 2n ** 256n) throw new Error('Amount is outside the supported range.');
  return n;
}
export function formatAmount(value: bigint, places = 6): string {
  const [whole, fraction = ''] = formatUnits(value, 18).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const shown = fraction.slice(0, places).replace(/0+$/, '');
  return grouped + (shown ? '.' + shown : '');
}
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export function validateOffer(offer: Offer, now = Math.floor(Date.now() / 1000)) {
  if (!isAddress(offer.maker) || offer.maker === zeroAddress || !isAddress(offer.taker)) throw new Error('Invalid offer wallet address.');
  for (const n of [offer.musdAmount, offer.btcAmount, offer.expiry, offer.nonce]) if (typeof n !== 'bigint' || n < 0n || n >= 2n ** 256n) throw new Error('Invalid offer integer.');
  if (offer.musdAmount === 0n || offer.btcAmount === 0n) throw new Error('Trade amounts must be greater than zero.');
  if (offer.expiry <= BigInt(now)) throw new Error('This offer has expired.');
}
export function encodeOffer(signed: SignedOffer): string {
  return encodeURIComponent(JSON.stringify(signed, (_, value) => typeof value === 'bigint' ? value.toString() : value));
}
export function decodeOffer(encoded: string, settlement: Address): SignedOffer {
  if (encoded.length > 16000) throw new Error('Offer link is too large.');
  const raw = JSON.parse(decodeURIComponent(encoded));
  if (raw.version !== 1 || raw.chainId !== CHAIN_ID || !isAddress(raw.settlement) || getAddress(raw.settlement) !== getAddress(settlement)) throw new Error('Offer is for a different deployment or network.');
  if (typeof raw.signature !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(raw.signature) || raw.signature.length > 8194) throw new Error('Invalid signature encoding.');
  const o = raw.offer;
  if (!o || !isAddress(o.maker) || !isAddress(o.taker)) throw new Error('Invalid wallet addresses.');
  for (const key of ['musdAmount', 'btcAmount', 'expiry', 'nonce']) if (typeof o[key] !== 'string' || !/^(0|[1-9]\d{0,77})$/.test(o[key])) throw new Error('Invalid offer amount.');
  const offer: Offer = { maker: getAddress(o.maker), taker: getAddress(o.taker), musdAmount: BigInt(o.musdAmount), btcAmount: BigInt(o.btcAmount), expiry: BigInt(o.expiry), nonce: BigInt(o.nonce) };
  validateOffer(offer);
  return { version: 1, chainId: CHAIN_ID, settlement: getAddress(raw.settlement), offer, signature: raw.signature };
}
export function nonce() { const bytes = crypto.getRandomValues(new Uint8Array(16)); return BigInt('0x' + Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('')); }
