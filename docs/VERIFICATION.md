# Explorer source verification

The deployed MUSD Match contract is [0x6316796dC8D2014405003e09d3aD0CeB51987c33](https://explorer.test.mezo.org/address/0x6316796dC8D2014405003e09d3aD0CeB51987c33?tab=contract) on Mezo testnet. Its source remains **unverified on the explorer** as of 2026-10-25.

## Reproducible inputs

- Contract: `src/MUSDMatch.sol:MUSDMatch` from `contracts/`.
- Compiler: `v0.8.24+commit.e11b9ed9`.
- Optimizer: enabled, 200 runs; EVM: London; license: MIT.
- Constructor argument: canonical testnet MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, ABI encoded as `000000000000000000000000118917a40faf1cd7a13db0ef56c86de7973ac503`.
- Deployment transaction: [0x8ae991f6c698c0d985f155179cd69b1541d661788e4c89c8f08c86f2b3687ae3](https://explorer.test.mezo.org/tx/0x8ae991f6c698c0d985f155179cd69b1541d661788e4c89c8f08c86f2b3687ae3).

The local compiled creation bytecode **plus the ABI encoded constructor argument** was compared byte for byte with that transaction's input and matched. The runtime code hash is `0x9a29cf7c56af4171a54f3265b856d540a42f909bc1e491b758e6bfbca4b54132`. Neither check publishes source in Blockscout.

## Retry with the explorer's Foundry method

From `contracts/`, run:

```sh
forge verify-contract \
  --rpc-url https://rpc.test.mezo.org \
  --verifier blockscout \
  --verifier-url https://api.explorer.test.mezo.org/api/ \
  --chain 31611 \
  --constructor-args 000000000000000000000000118917a40faf1cd7a13db0ef56c86de7973ac503 \
  --watch \
  0x6316796dC8D2014405003e09d3aD0CeB51987c33 \
  src/MUSDMatch.sol:MUSDMatch
```

On 2026-10-25 the tracked standard JSON and Foundry submissions finished with `Fail - Unable to verify`. The single-file and multipart API submissions were accepted but did not publish source. The web form displayed `verifier service connection` after submission. Foundry may exit with status zero even when its output says verification failed, so check the actual status and the explorer's Code tab. The contract currently still shows `Verify & publish` and the API reports `is_verified: false`. This points to an explorer verifier service problem, although its generic API error does not identify a definitive cause. Retry when the service recovers or report the exact command and address to the explorer operator. Do not describe the source as verified until the explorer displays it.

The [Blockscout Foundry verification guide](https://docs.blockscout.com/devs/verification/foundry-verification) and [Blockscout UI verification guide](https://docs.blockscout.com/devs/verification/blockscout-ui) describe the supported methods.
