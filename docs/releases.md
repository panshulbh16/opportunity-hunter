# Releases

Railway runs Next.js and keeps the existing SQLite volume. Cloudflare forwards the public hostname to that origin. No database migration is involved.

## One-time setup

In GitHub Settings → Secrets and variables → Actions, add:

- `RAILWAY_TOKEN`: a Railway project token scoped to this project's production environment (not a personal login token).
- `CLOUDFLARE_API_TOKEN`: a token scoped to this account and opportunityhunter.xyz, with Account / Workers Scripts / Edit and Zone / Workers Routes / Edit plus Zone / Zone / Read.
- `CLOUDFLARE_ACCOUNT_ID`: `c429b2fc4f62d2414c880d87fce53206`.

Keep the current proxied DNS record pointing to Railway. Before merging the workflow, disable Railway's independent GitHub auto-deploy trigger (disconnect the GitHub source in service settings); keep the service, environment variables and volume. Deployments must then come only from the gated workflow. Until this is done, direct Railway auto-deploys can bypass tests.

Merge to main, then watch Actions → Test and release. Pull requests run checks without production credentials. Protect main with the `test` check and require pull requests to prevent untested changes from being merged.

## What runs

Type checking, existing AI matching and billing checks, signed webhook route regressions, Cloudflare forwarding checks, production build, and production-server page checks. Payment cases cover invalid signatures, failed payments, activation using only a webhook, duplicate events, late failures, expiry and replay after expiry. Existing billing checks cover INR/USD selection and pass stacking.

Only after checks pass, CI stamps the exact commit, deploys Railway, waits for its database-ready version endpoint, deploys the Cloudflare Worker, and checks the public version and pages. A missing credential or version/cache mismatch fails the release; it does not report success or automatically roll back.

Cloudflare bypasses its cache for every request and returns `no-store` for browsers and downstream caches, including assets. New requests after a successful release see the verified version; already-open tabs are not forcibly reloaded. Previously browser-cached assets cannot be remotely erased; Next.js content-hashed asset URLs prevent new pages from referencing old assets.

## Manual payment evidence

Automated tests do not charge customers or prove real Razorpay delivery / foreign-card authorization. Verify those separately with an authorized transaction: pay, close checkout before the client callback, check Razorpay delivery status and access activation; repeat with an eligible international card. Never store card details or provider secrets in fixtures.

## Failed deployment

Inspect the failing Actions step. If Railway or Cloudflare has already changed, the release can be partially applied. Rerun the workflow after correcting the problem, or redeploy a known-good revision using Railway and the corresponding Worker. Never reset or replace the SQLite volume to roll back application code.
