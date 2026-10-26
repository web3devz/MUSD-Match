# MUSD Match

Direct, signed MUSD for native BTC trades on Mezo testnet. A seller sets exact terms, signs an EIP-712 offer, approves MUSD, and shares a private link. A buyer checks the offer and settles both legs atomically. There is no pooled deposit, protocol fee, admin, upgrade key, or partial fill.

## What is ready

- Responsive example board and a separate testnet trading screen. Example cards are clearly labelled and never executable.
- Wallet signing, link import/export, exact token approval, offer checks, transaction simulation, fill and cancellation with explorer receipts.
- Solidity settlement with nonce replay protection, EOA/ERC-1271 signatures, expiry, taker restriction, reentrancy guard and exact token balance checks.
- Local automated tests: `npm test` and `npm run test:contracts`. A cross-language EIP-712 digest fixture checks frontend/contract encoding.

**Live state:** The settlement is deployed on Mezo testnet at [`0x6316796dC8D2014405003e09d3aD0CeB51987c33`](https://explorer.test.mezo.org/address/0x6316796dC8D2014405003e09d3aD0CeB51987c33). The app checks chain, token and runtime bytecode hash before enabling transactions. A [two-wallet fill](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75) succeeded. [Explorer source publication](docs/VERIFICATION.md) is pending after a verifier service error. Mainnet is not supported. The code is unaudited.

## Run locally

Use Node 22.10+ or 24, npm and Foundry. In this directory:

```sh
npm ci
npm run dev
npm run build
npm test
npm run test:contracts
```

Open the URL printed by Vite. `npm run build` performs a TypeScript check and a production build. If Foundry cannot download solc 0.8.24, install the compiler and run the contract tests with `forge test --use /path/to/solc` from `contracts/`.

## Deploy on Mezo testnet

Use a dedicated testnet wallet with BTC for gas. Verify the official [Mezo developer docs](https://mezo.org/docs/developers/getting-started/) and current [MUSD deployments](https://mezo.org/docs/developers/musd/musd-redemptions/) independently. The configured RPC must report chain ID **31611** and the intended MUSD token must exist at `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, with 18 decimals and symbol `MUSD`.

The locally generated project wallets are in `.secrets/mezo-testnet-wallet.json` (seller/deployer) and `.secrets/mezo-testnet-buyer.json` (buyer). These ignored files contain **unencrypted** private keys with owner-only permissions; back them up privately and use them only for small testnet amounts. Their addresses can be shared. The local deployment script reads the seller key file directly and never prints it or passes it in a shell argument. Never commit or share either file.

For this funded wallet, run from the project root in an unrestricted terminal:

```sh
node scripts/deploy-local-wallet.mjs
```

This checks chain ID, MUSD token, gas balance, deployment receipt, runtime code and constructor token. It records the transaction hash in ignored `.secrets/deployment.json` before waiting for confirmation; rerunning resumes that same transaction instead of submitting another. When confirmed, it writes `.env.local`. If the compiled artifact is missing, run `cd contracts && forge build && cd ..` first. Independently review the deployed source and constructor argument in the explorer before trading.

Alternatively, to deploy using an encrypted Foundry keystore, use the following flow:

```sh
# Once, in your terminal. Foundry encrypts the key in its own keystore.
cast wallet import musd-match-testnet --interactive
export MATCH_KEYSTORE_ACCOUNT=musd-match-testnet
export MATCH_RPC_URL=https://rpc.test.mezo.org

# Preflight checks RPC and token; Foundry prompts for the keystore password.
bash scripts/deploy-testnet.sh

# Replace this with the deployment address printed by Foundry.
node scripts/verify-deployment.mjs 0xYOUR_SETTLEMENT_ADDRESS
```

Compare the deployed code and constructor argument with `contracts/src/MUSDMatch.sol` and the [testnet explorer](https://explorer.test.mezo.org/) before funding. Copy the three printed `VITE_` lines into `.env.local` (see `.env.example`), then restart Vite. The browser checks chain ID, runtime bytecode hash, token address and token metadata before enabling actions. Keep `.env.local`, wallet secrets and Foundry keystores outside git. The deployment script never receives a raw key in an environment variable or command argument.

## Two-wallet smoke test

The test seller is `0x486bCc5E0FFc6b1Dc9Ed9E236Dd6bA9e5Fd991a0`; the test buyer is `0x8d22d5cB85b88aC8DCE60C5DCea3Afae5230E961`. Both have ignored local key files described above. Import them privately into a supported browser wallet; never put their keys into this app or the repository. The seller needs testnet MUSD plus BTC for gas; the buyer needs native testnet BTC for the exact offer and gas. The official Mezo Borrow flow can mint testnet MUSD against BTC collateral. On 2026-10-25 a [live two-wallet fill](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75) exchanged exactly 100 MUSD for 0.001 testnet BTC. See [the deployment and receipt record](docs/DEPLOYMENT.md). The optional `scripts/live-demo.mjs` executes a *new* fixed trade when passed `--execute-testnet-trade`; without arguments it prints the plan and sends nothing.

1. Use the two funded Mezo testnet wallets described above.
2. Open the app in wallet A, switch to **Mezo testnet**, connect and create a small offer, optionally restricting wallet B. Sign; then approve exactly the displayed MUSD amount. Wait for the approval receipt.
3. Copy the signed link, open it with wallet B, connect, check signature and availability, then fill. Verify the receipt, token balances, BTC transfer and `nonceUsed` in the explorer.
4. Create a second offer, cancel it from wallet A and verify wallet B cannot fill it. Check a fresh offer expired or for the wrong buyer is rejected.

Signatures and local lists do not reserve MUSD. Allowance is contract-wide, even if initially set to one offer amount. A user may reduce approval from their wallet after trading. Shared links carry exact terms but do not verify a seller's off-chain identity.

## Project map

| Path | Purpose |
| --- | --- |
| `src/main.tsx`, `src/styles.css` | Responsive interface and example mode |
| `src/LiveTrading.tsx`, `src/chain.ts`, `src/offers.ts` | Testnet trading, chain checks, offer parsing |
| `contracts/src/MUSDMatch.sol` | Immutable settlement |
| `contracts/test/MUSDMatch.t.sol`, `tests/offers.test.ts` | Contract and application tests |
| `scripts/` | Testnet deployment and on-chain verification |
| `docs/` | Research, architecture, security and submission copy |

See [deployment](docs/DEPLOYMENT.md), [hosting](docs/HOSTING.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [research](docs/RESEARCH.md) and [submission](docs/SUBMISSION.md). No repository remote or GitHub upload is configured here.
