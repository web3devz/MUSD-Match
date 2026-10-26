# Sources and network verification

Checked 2026-10-25:

- https://mezo.org/docs/developers/getting-started/ — testnet chain ID 31611, BTC gas, London compiler target in the official example.
- https://mezo.org/docs/developers/musd/musd-redemptions/ — published testnet MUSD address `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`. This is a reference candidate, not independent on-chain verification.
- https://mezo.org/docs/developers/musd/
- https://github.com/mezo-org/musd
- https://mezo.org/docs/developers/features/mezo-earn/mezo-earn/
- https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10?tab=overview
- https://eips.ethereum.org/EIPS/eip-712
- https://eips.ethereum.org/EIPS/eip-1271

Network: `https://rpc.test.mezo.org`; explorer: `https://explorer.test.mezo.org/`.

The testnet deployment succeeded in transaction `0x8ae991f6c698c0d985f155179cd69b1541d661788e4c89c8f08c86f2b3687ae3` at `0x6316796dC8D2014405003e09d3aD0CeB51987c33`. The on-chain preflight verified chain ID, token bytecode, 18 decimals, symbol and constructor token. Its runtime bytecode hash is `0x9a29cf7c56af4171a54f3265b856d540a42f909bc1e491b758e6bfbca4b54132`. The explorer independently showed the successful creation and the intended constructor argument. [Source publication](VERIFICATION.md) remains pending after the explorer verifier service failed; the compiled creation code plus constructor argument matched the transaction input exactly. A [live testnet fill](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75) later confirmed 100 MUSD for 0.001 BTC with exact wallet deltas; see [deployment record](DEPLOYMENT.md). The local tests and live transaction are distinct evidence.

AMM comparisons are not fabricated: initial UI shows the exact signed trade rate and explicitly makes no claim of savings versus a pool. A live comparison requires verified pool/router addresses and an executable same-size quote with timestamp/block.
