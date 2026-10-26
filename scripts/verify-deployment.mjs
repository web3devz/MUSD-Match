import { createPublicClient, getAddress, http, isAddress, keccak256, parseAbi } from 'viem';

const chainId = 31611;
const token = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503';
const rpc = process.env.MATCH_RPC_URL || 'https://rpc.test.mezo.org';
const settlement = process.argv[2];
const client = createPublicClient({ transport: http(rpc, { timeout: 15000, retryCount: 1 }) });
const tokenAbi = parseAbi(['function decimals() view returns (uint8)', 'function symbol() view returns (string)']);
try {
  if (await client.getChainId() !== chainId) throw new Error('RPC chain ID is not Mezo testnet (31611).');
  if (!await client.getCode({ address: token })) throw new Error('MUSD token code is missing.');
  const [decimals, symbol] = await Promise.all([
    client.readContract({ address: token, abi: tokenAbi, functionName: 'decimals' }),
    client.readContract({ address: token, abi: tokenAbi, functionName: 'symbol' }),
  ]);
  if (decimals !== 18 || symbol !== 'MUSD') throw new Error(`Unexpected token metadata: ${symbol}, ${decimals} decimals. Recheck the official token before proceeding.`);
  console.log(`Mezo testnet RPC and MUSD token verified: ${token} (${symbol}, ${decimals} decimals).`);
  if (settlement) {
    if (!isAddress(settlement)) throw new Error('Invalid settlement address.');
    const code = await client.getCode({ address: getAddress(settlement) });
    if (!code) throw new Error('Settlement runtime code is missing.');
    const musd = await client.readContract({ address: settlement, abi: parseAbi(['function musd() view returns (address)']), functionName: 'musd' });
    if (getAddress(musd) !== getAddress(token)) throw new Error('Settlement was created with a different token.');
    console.log(`Settlement token verified: ${musd}`);
    console.log(`VITE_SETTLEMENT_ADDRESS=${getAddress(settlement)}`);
    console.log(`VITE_SETTLEMENT_CODEHASH=${keccak256(code)}`);
    console.log(`VITE_MEZO_RPC_URL=${rpc}`);
    console.log('Compare source, compiler version, constructor argument and deployed runtime against the explorer before funding.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
