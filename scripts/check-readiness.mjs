import { readFileSync } from 'node:fs';
import { createPublicClient, erc20Abi, formatEther, formatUnits, getAddress, http, keccak256, parseAbi } from 'viem';

const rpc = process.env.MATCH_RPC_URL || 'https://rpc.test.mezo.org';
const token = getAddress('0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503');
const settlement = getAddress('0x6316796dC8D2014405003e09d3aD0CeB51987c33');
const expectedHash = '0x9a29cf7c56af4171a54f3265b856d540a42f909bc1e491b758e6bfbca4b54132';
const seller = JSON.parse(readFileSync(new URL('../.secrets/mezo-testnet-wallet.json', import.meta.url), 'utf8')).address;
const buyer = JSON.parse(readFileSync(new URL('../.secrets/mezo-testnet-buyer.json', import.meta.url), 'utf8')).address;
const client = createPublicClient({ transport: http(rpc, { timeout: 15000, retryCount: 1 }) });

try {
  if (await client.getChainId() !== 31611) throw new Error('RPC did not report Mezo testnet chain 31611.');
  const code = await client.getCode({ address: settlement });
  if (!code || keccak256(code).toLowerCase() !== expectedHash) throw new Error('Settlement bytecode differs from the verified deployment.');
  const [onchainToken, decimals, symbol, sellerBTC, buyerBTC, sellerMUSD] = await Promise.all([
    client.readContract({ address: settlement, abi: parseAbi(['function musd() view returns (address)']), functionName: 'musd' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
    client.getBalance({ address: seller }),
    client.getBalance({ address: buyer }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [seller] }),
  ]);
  if (getAddress(onchainToken) !== token || decimals !== 18 || symbol !== 'MUSD') throw new Error('Unexpected MUSD contract or metadata.');
  console.log(`Settlement: ${settlement} · Mezo testnet chain 31611 · code hash matched`);
  console.log(`Seller ${seller}: ${formatEther(sellerBTC)} BTC, ${formatUnits(sellerMUSD, 18)} MUSD`);
  console.log(`Buyer  ${buyer}: ${formatEther(buyerBTC)} BTC`);
  if (sellerMUSD === 0n || buyerBTC === 0n) {
    console.log('A live match needs seller MUSD and buyer BTC for the exact payment plus gas. No transaction was sent.');
    process.exitCode = 2;
  } else console.log('Both wallets hold the assets needed to attempt a small exact trade. No transaction was sent.');
} catch (error) {
  console.error(error instanceof Error ? error.shortMessage || error.message : error);
  process.exitCode = 1;
}
