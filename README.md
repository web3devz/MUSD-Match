# MUSD Match

### Your terms. One atomic MUSD ↔ BTC trade.

MUSD Match lets two people exchange **MUSD for native BTC on Mezo testnet** without depositing into a pool. A seller signs exact terms and shares a private offer link. A buyer reviews the live offer and fills it in one transaction: MUSD goes to the buyer and BTC goes to the seller, or the whole transaction reverts.

**[Launch the app](https://musd-match.vercel.app/) · [See the live trade](#testnet-proof) · [Run locally](#run-locally) · [Security model](docs/SECURITY.md)**

> **Testnet software.** A real two-wallet fill succeeded. Explorer source publication remains pending and the code has not been independently audited. No mainnet support, price oracle, market-price guarantee, or guaranteed liquidity.

## The problem

MUSD gives Bitcoin holders a dollar-denominated asset on Mezo. When two people already agree on a price, they should be able to exchange directly with explicit terms and all-or-nothing settlement. MUSD Match makes that agreement signable, shareable, checkable, and executable. It does **not** claim to beat an AMM quote; compare the offered rate yourself.

| Seller | Buyer | Settlement |
| --- | --- | --- |
| Chooses exact MUSD and BTC amounts, expiry, optional buyer, and nonce; signs EIP-712 terms and approves MUSD | Opens the link, checks the terms and live availability, then pays exact native BTC | One Mezo transaction transfers both assets; a filled or cancelled nonce cannot be reused |

There is no custody before a fill, protocol fee, admin key, upgrade proxy, or partial fill. A signature does not reserve the seller's MUSD.

## Testnet proof

The [settlement contract](https://explorer.test.mezo.org/address/0x6316796dC8D2014405003e09d3aD0CeB51987c33) is deployed on **Mezo testnet, chain ID 31611**. The browser checks the runtime code hash, MUSD token, and chain before enabling live transactions.

| Step | Verified result |
| --- | --- |
| [Deployment](https://explorer.test.mezo.org/tx/0x8ae991f6c698c0d985f155179cd69b1541d661788e4c89c8f08c86f2b3687ae3) | Settlement deployed with testnet MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| [Exact approval](https://explorer.test.mezo.org/tx/0x1cd08da5f74dde9cf28344892120b2265f25d086f10edc9749e1e29eb0a343db) | Seller approved 100 MUSD |
| [Atomic fill](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75) | Buyer received **100 MUSD**; seller received **0.001 testnet BTC**; nonce consumed |
| [Cancellation](https://explorer.test.mezo.org/tx/0x591fe92e4906db867e0683d5e94585d189b3928772bc1b10e9c5cd78f9be48d6) | Seller cancelled a separate nonce |

These are actual testnet transactions, not simulated UI activity. The [deployment record](docs/DEPLOYMENT.md) gives addresses, blocks, balance deltas, and compiler settings. The explorer did not publish the source despite a byte-for-byte match between the compiled creation code plus constructor argument and the deployment input; [verification attempts](docs/VERIFICATION.md) are documented separately.

## Try it

1. Open [musd-match.vercel.app](https://musd-match.vercel.app/) or [run locally](#run-locally). **Example mode** works without a wallet and labels sample offers; they cannot be traded.
2. Switch to **Mezo testnet** and connect an EVM wallet. The app verifies the deployed contract before live actions.
3. As seller, sign an offer, approve its exact MUSD amount, and share the link. The offer lives in the URL fragment; this is not a public orderbook.
4. As buyer, open the link with another wallet, inspect the exact amounts, and fill. Follow the explorer receipt.
5. As seller, cancel a different offer on-chain to invalidate its nonce.

Use **testnet BTC and MUSD only**. The seller needs MUSD and gas; the buyer needs the offered BTC plus gas. The [Mezo faucet](https://faucet.test.mezo.org/) and [borrow guide](https://mezo.org/docs/users/borrow/mint-musd/) explain test assets. Judges can inspect the completed trade above without funding wallets.

## How it protects the trade

- **Exact intent:** EIP-712 binds maker, optional taker, both amounts, expiry, and nonce to this chain and settlement address. EOAs and ERC-1271 contract wallets are supported.
- **All or nothing:** A fill consumes the nonce and transfers both assets in one transaction. Failed or inexact transfers roll everything back.
- **Live checks:** The UI checks signature, balance, allowance, nonce, and deployment code, and simulates writes before sending.
- **Limited authority:** No owner, arbitrary execution, rescue method, upgrade mechanism, or fee recipient. Only a maker can cancel their nonce.

The buyer still judges price and seller identity. Signed offers do not lock inventory; links can be forwarded; public offers can be filled by anyone. Read the [security model](docs/SECURITY.md) and [architecture](docs/ARCHITECTURE.md).

## Run locally

Requires Node 22.10+ (or 24), npm, and Foundry for contract tests.

```sh
git clone <your-repository-url>
cd musd-match
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. The public testnet address and runtime hash are defaults in `src/chain.ts`; no private environment file is needed to view the app. To choose another verified deployment, start from [.env.example](.env.example).

```sh
npm test                 # 7 offer and exact-unit tests
npm run test:contracts   # 28 Foundry tests, including 256 fuzz runs
npm run build            # TypeScript check and production build
```

The contract suite covers replay, cancellation, restricted takers, signature domains, ERC-1271, reentrancy, failed transfers, and conservation. Local mocks exercise edge cases; the [live fill](docs/DEPLOYMENT.md) demonstrates actual testnet settlement. Foundry's offline test command requires solc 0.8.24 already installed.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/styles.css` | Responsive board and explicitly labelled example mode |
| `src/LiveTrading.tsx`, `src/chain.ts`, `src/offers.ts` | Wallet flow, chain checks, integer amounts, signed links |
| `contracts/src/MUSDMatch.sol` | Immutable atomic settlement |
| `contracts/test/`, `tests/` | Solidity and TypeScript tests |
| `scripts/` | Deployment preflight, readiness checks, optional live demo |
| `docs/` | Evidence, research, security, hosting, and submission material |

The app is a static Vite build, [deployed on Vercel](https://musd-match.vercel.app/). [Hosting instructions](docs/HOSTING.md) cover redeployment, Netlify, and GitHub Pages. Never upload `.secrets/`, `.env.local`, or wallet keys. The optional live demo script sends **new** transactions only with its explicit execution flag.

## Scope and next steps

V1 uses private links and browser-local offers rather than a shared orderbook. It has no partial fills, oracle, guaranteed liquidity, mainnet deployment, or independent audit. Next: publish source on the explorer when its verifier works, capture a browser-wallet demo video, and consider optional indexed discovery without expanding settlement authority.

Built for Mezo testnet. Read the [two-minute pitch](docs/SUBMISSION.md) or inspect the [confirmed fill](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75).
