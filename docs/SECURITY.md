# Security model

Unaudited testnet software. No independent audit is claimed.

The settlement contract binds maker, optional taker, exact MUSD/BTC amounts, nonce and expiry to the EIP-712 chain and contract domain. A successful fill consumes the maker nonce and transfers both assets in one transaction. Either failed transfer reverts the entire transaction and nonce change. Exact MUSD balance deltas reject transfer fees; canonical token behavior and issuer powers remain external risks.

No owner, upgradeability, escrow, arbitrary calls, fee recipient, or rescue function. Forced native dust, if any, is never paid as part of a fill. Contract-wallet makers must accept native BTC and support ERC-1271. EOA signatures enforce low-s and v 27/28. Only 65-byte EOA signatures are supported in v1.

Public offers can be filled by any counterparty. Use a restricted taker when front-running or private allocation matters. Signed offers do not reserve seller assets. Sharing a link discloses the offer. Seller identity is an address, not a verified person. No market-price oracle or guaranteed liquidity exists.

Before funded use: independently review signature encoding, token address, precompile behavior, wallet compatibility, compiler target, exact transfer semantics and real two-wallet settlements. A self-review is not an audit.
