# Product and security boundaries

V1 sells MUSD for native BTC. Offer fields: maker, optional restricted taker, MUSD amount, BTC amount, expiry, nonce. All quantities use 18-decimal integer base units. A quote is an exact exchange ratio, not an assertion of a dollar market price.

The seller signs EIP-712 data scoped to chain ID and settlement address. Signing does not reserve assets. Buyers must check current funds, approval, expiry, cancellation, taker restriction and simulate execution. The settlement consumes a maker nonce before external calls and atomically transfers MUSD maker → buyer and BTC buyer → maker. The transaction reverts if either side fails. No partial fills, escrow, fees, refunds, or arbitrary-call functionality.

EOA signatures enforce low-s and correct v. ERC-1271 signatures are checked using staticcall. Cancellation is on-chain by maker nonce. All offers sharing a consumed nonce are invalid. Exact token balance deltas reject fee-on-transfer behavior. The canonical MUSD's external controls remain a dependency risk.

The board has distinct Example and Mezo testnet modes. Example offers are never executable. V1 private links encode signed offers in the URL fragment; there is no promise of global discovery or durable hosting. Browser storage is untrusted and must be parsed and revalidated. The connected account must approve only the exact offer amount. Live execution stays disabled until a verified deployment is configured.

External keys never enter the app. Browser wallets sign. Deployment requires a separately configured testnet signer. Mainnet deployment and real-money trades are out of scope.
