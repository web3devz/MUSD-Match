# Submission kit

## Project description

MUSD Match is a direct matching layer for exchanging MUSD and native BTC on Mezo. A seller signs exact terms and shares an offer link. A buyer verifies that offer and fills it in one transaction. The settlement contract transfers MUSD to the buyer and native BTC to the seller atomically. Sellers retain custody until fill. V1 charges no protocol fee and offers no partial fills.

## Why it matters

People who want a specific MUSD/BTC exchange can coordinate directly without first depositing into a pooled market. Exact terms, seller restrictions, expiry, signature domain and one-use nonce are part of the offer. This is a peer-to-peer execution option; it makes no claim that a direct quote is cheaper than an AMM or closer to a market price.

## What to show judges (2 minutes)

1. **00:00–00:20** Show the offer board. Explain the explicit example/testnet distinction and the direct trade problem.
2. **00:20–00:45** In Mezo testnet mode, seller connects and signs 100 MUSD for an exact BTC amount. Point out that signing does not move funds.
3. **00:45–01:10** Seller approves exactly 100 MUSD and shares the private link. Buyer imports it in another wallet and sees maker, expiry and the precise payment.
4. **01:10–01:35** Buyer checks live funds, allowance, signature and nonce; settles. Open the explorer receipt and show both balances and consumed nonce. Use a pre-funded, small testnet offer to make the demonstration reliable.
5. **01:35–02:00** Show cancellation of a second signed offer and a rejected repeat fill. Explain the safeguards and limitations candidly.

The testnet settlement is deployed, and a two-wallet fill succeeded on Mezo testnet. Show the [fill receipt](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75), exact token and BTC balance changes, and [cancellation receipt](https://explorer.test.mezo.org/tx/0x591fe92e4906db867e0683d5e94585d189b3928772bc1b10e9c5cd78f9be48d6). See [deployment record](DEPLOYMENT.md) for all evidence. The initial smoke script cancelled a separate nonce; for the video, sign a second offer before cancelling it in the UI if presenting that flow.

## Judge evidence to capture after deployment

| Evidence | What to record |
| --- | --- |
| Deployment | [Contract](https://explorer.test.mezo.org/address/0x6316796dC8D2014405003e09d3aD0CeB51987c33), [creation receipt](https://explorer.test.mezo.org/tx/0x8ae991f6c698c0d985f155179cd69b1541d661788e4c89c8f08c86f2b3687ae3), constructor MUSD address, compiler version, runtime code hash |
| Offer | Signed terms with sensitive wallet identity disclosed only with permission; chain and verifying contract |
| Approval | [Seller approved exactly 100 MUSD](https://explorer.test.mezo.org/tx/0x1cd08da5f74dde9cf28344892120b2265f25d086f10edc9749e1e29eb0a343db) |
| Settlement | [Fill receipt](https://explorer.test.mezo.org/tx/0x826814cbd6b3d3deda1fa1228d1141a4fbe6ab14e7e31c89d169c6b928e90f75), `Filled` event, buyer +100 MUSD, seller +0.001 BTC, consumed nonce |
| Cancellation | [Separate nonce cancellation](https://explorer.test.mezo.org/tx/0x591fe92e4906db867e0683d5e94585d189b3928772bc1b10e9c5cd78f9be48d6); no later fill was broadcast |
| Demo | Two-wallet screen recording with actual testnet receipts |

## Limits and next work

V1 has private link distribution and a browser-local list, not a shared orderbook. Offers do not reserve assets, and approvals may become stale. There is no partial fill, oracle, fiat valuation, liquidity guarantee, mobile wallet compatibility guarantee, independent audit or mainnet rollout. Future features can add optional discovery, order states from indexed events, permit flows if supported by canonical MUSD, and independent security review.

## Links

- [Mezo development](https://mezo.org/docs/developers/getting-started/)
- [MUSD docs](https://mezo.org/docs/developers/musd/)
- [Mezo testnet explorer](https://explorer.test.mezo.org/)
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271)
- [Wave Hacks overview](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10?tab=overview)

Before submission, add the actual repository URL, live demo URL, and verified explorer source once available. A successful testnet trade is evidenced above; do not claim prize eligibility, a mainnet trade, or an independently audited contract.
