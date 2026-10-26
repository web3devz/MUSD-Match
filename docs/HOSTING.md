# Hosting the static demo

MUSD Match is a client-only Vite app. The testnet settlement address and runtime code hash are public defaults in `src/chain.ts`; wallet keys and `.env.local` are ignored. Never add `.secrets/` to a hosting provider.

Run `npm ci && npm run build`, then host `dist/` on a static HTTPS host. Relative asset URLs support a domain root or a repository subpath. HTTPS is needed for browser wallet and clipboard behavior. The private offer link uses a URL fragment (`#offer=…`), so it stays in the browser and works with static hosting without a server rewrite.

For GitHub Pages, upload the repository, select **GitHub Actions** as the Pages source in repository settings, then manually run **Publish testnet demo** from the Actions tab. The included workflow builds with Node 24 and publishes `dist/`. It runs only when you trigger it; uploading the repository does not automatically publish a site. For Netlify, set build command `npm run build` and publish directory `dist`; for Vercel, choose Vite and output directory `dist`. Configure a public project name and URL only after the actual host is live.

Before sharing with judges, open the hosted page on desktop and mobile, switch to Mezo testnet, and check the banner says **Deployment verified · Mezo testnet**. If the RPC is unreachable or bytecode changes, the trading controls lock themselves. Import only a testnet wallet into a browser extension you trust. Do not put a private key in the site, a URL or a GitHub secret.
