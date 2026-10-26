#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${MATCH_KEYSTORE_ACCOUNT:?Set MATCH_KEYSTORE_ACCOUNT to a Foundry keystore account name.}"
MATCH_RPC_URL="${MATCH_RPC_URL:-https://rpc.test.mezo.org}"
export MATCH_RPC_URL

cd "$project_dir"
node scripts/verify-deployment.mjs
echo 'Preflight passed. Foundry will request your keystore password and broadcast a testnet deployment.'
cd contracts
forge create src/MUSDMatch.sol:MUSDMatch \
  --rpc-url "$MATCH_RPC_URL" \
  --account "$MATCH_KEYSTORE_ACCOUNT" \
  --constructor-args 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 \
  --broadcast
echo 'Run node scripts/verify-deployment.mjs <deployed-address> from the project root, then copy its VITE_ lines into .env.local.'
