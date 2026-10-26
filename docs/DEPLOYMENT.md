# Mezo testnet deployment record

| Field | Value |
| --- | --- |
| Chain | Mezo testnet, `31611` |
| Settlement | [`0x6316796dC8D2014405003e09d3aD0CeB51987c33`](https://explorer.test.mezo.org/address/0x6316796dC8D2014405003e09d3aD0CeB51987c33) |
| Creation transaction | [`0x8ae991f6c698c0d985f155179cd69b1541d661788e4c89c8f08c86f2b3687ae3`](https://explorer.test.mezo.org/tx/0x8ae991f6c698c0d985f155179cd69b1541d661788e4c89c8f08c86f2b3687ae3) |
| Block | `16356621` |
| Deployer / test seller | `0x486bCc5E0FFc6b1Dc9Ed9E236Dd6bA9e5Fd991a0` |
| Canonical testnet MUSD constructor argument | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| Runtime code hash | `0x9a29cf7c56af4171a54f3265b856d540a42f909bc1e491b758e6bfbca4b54132` |
| Compiler | Solidity `0.8.24+commit.e11b9ed9`, optimizer 200 runs, EVM London |
| Source publication | Pending: [verification attempts and retry command](VERIFICATION.md); explorer verifier service connection error |
| End-to-end fill | Verified: 100 MUSD for 0.001 testnet BTC, block `16357599` |

The deploy script checked RPC chain ID, token code and metadata, constructor token, receipt status and runtime hash. The explorer independently showed a successful contract creation from the deployer to the address above, and creation calldata ending with the constructor MUSD address. The local compiled creation code plus constructor argument exactly matched the on-chain transaction input. The [source verification retry](VERIFICATION.md) still failed at the explorer. This is testnet evidence, not an audit.

## Prepare a live two-wallet trade

The seller is the deployer above. A separate local buyer wallet was generated at `0x8d22d5cB85b88aC8DCE60C5DCea3Afae5230E961`. Its recovery key is only in ignored `.secrets/mezo-testnet-buyer.json`; do not upload that file. The seller key is only in ignored `.secrets/mezo-testnet-wallet.json`. Import each account privately into a browser wallet to use the app UI; the app never reads key files.

On 2026-10-25, `node scripts/check-readiness.mjs` verified the chain, token, runtime code hash, and balances. Seller held 1,877.0687826208004 MUSD and approximately 0.02 testnet BTC; buyer held 0.05 testnet BTC. These are a snapshot, not a guarantee of current balances. The [official Mezo testnet borrow guide](https://mezo.org/docs/users/borrow/mint-musd/) describes minting MUSD against testnet BTC; the [official faucet](https://faucet.test.mezo.org/) dispenses testnet BTC.

Run `node scripts/check-readiness.mjs` again before any further trade. It reads balances and deployment without signing. `scripts/live-demo.mjs` executes a fresh fixed 100 MUSD for 0.001 BTC trade restricted to the local buyer, followed by a separate nonce cancellation. Running it without arguments prints the plan and sends nothing; `--execute-testnet-trade` submits new transactions using the locally ignored testnet wallet files. Review it before each run: another run can trade another 100 MUSD.

## Live smoke test, 2026-10-25

| Action | On-chain evidence |
| --- | --- |
| Seller approves 100 MUSD | [Successful approval, block 16357591](https://explorer.test.mezo.org/tx/0x1cd08da5f74dde9cf28344892120b2265f25d086f10edc9749e1e29eb0a343db) |
| Buyer fills signed, buyer-restricted offer | [Successful fill, block 16357599](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75) |
| Seller cancels a separate nonce | [Successful cancellation, block 16357610](https://explorer.test.mezo.org/tx/0x591fe92e4906db867e0683d5e94585d189b3928772bc1b10e9c5cd78f9be48d6) |

An independent read of receipts confirmed all three succeeded. The settlement emitted `Filled` with maker `0x486bCc5E0FFc6b1Dc9Ed9E236Dd6bA9e5Fd991a0`, taker `0x8d22d5cB85b88aC8DCE60C5DCea3Afae5230E961`, nonce `319857425467165970518083100995355616460`, 100 MUSD and 0.001 BTC. The seller's MUSD decreased by exactly 100, the buyer's MUSD increased by exactly 100, the seller's native BTC increased by exactly 0.001 after the approval, and the offer nonce was consumed. The cancellation emitted `Cancelled` for nonce `48584981439077155720021462122881525773`, which read back as used. These are testnet transactions, not a security audit. The contract's explorer source publication is still pending.
