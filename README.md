# Opportunity Hunter

AI-powered job discovery agent. Tell it what you want; it keeps hunting, scores every listing 0–100, explains why, and tracks what you've seen, saved, applied to and rejected.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Demo account: `demo@opportunityhunter.app` / `demo1234` (Pro plan, admin).

`npm run check` type-checks and runs the matching-engine self-test.

## Stack

Next.js 15 (App Router, server actions) · SQLite via `better-sqlite3` (file at `./data/app.db`, schema auto-created) · Tailwind v4 · hand-rolled sessions (Node `crypto.scrypt`, httpOnly cookie).

## Layout

| Path | What |
|---|---|
| `src/lib/ai/index.ts` | `parseSearchProfile`, `generateSearchQueries`, `normalizeOpportunity`, `deduplicateOpportunities`, `calculateMatchScore`, `generateMatchExplanation`, `recommendNextAction`, `generateDailyDigest` — pure, deterministic, swappable for an LLM per function |
| `src/lib/agent.ts` | The Opportunity Hunter Agent: profile → queries → sources → normalize → dedupe → score → explain → save → notify. Enforces free-plan limits server-side |
| `src/lib/sources/` | `SourceAdapter` interface + registry. `jsearch.ts` is the live feed; `demo.ts` (30 fictional listings) is now only the engine's test fixture |
| `src/lib/boot.ts` | Seeds the demo account; runs due hunts every 15 min in-process. `POST /api/cron/hunt` (Bearer `CRON_SECRET`) for external schedulers |
| `src/lib/email.ts` | `EmailProvider` — console by default, Resend when `RESEND_API_KEY` is set |
| `src/lib/plans.ts` | Plan definitions and weekly discovery caps |
| `src/app/actions.ts` | All server actions (auth, profile, save/reject/apply, tracker, alerts, billing, admin) |

## Integrations (all optional, see `.env.example`)

- **Google login**: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Button appears automatically.
- **Email**: `RESEND_API_KEY`. Otherwise digests and reset links print to the server console.
- **Payments**: `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` turn on checkout. Pro is a 30-day pass (₹499, no auto-renew; buying again stacks), expired every 15 min in `boot.ts`. Add a Razorpay webhook to `/api/razorpay/webhook` for event `order.paid` with secret `RAZORPAY_WEBHOOK_SECRET`, so buyers who close the tab mid-payment still get Pro. Logic in `src/lib/razorpay.ts`; admins can still set plans manually at `/admin`.
- **Live job listings**: `RAPIDAPI_KEY` enables the JSearch adapter (`src/lib/sources/jsearch.ts`) — a licensed aggregator that includes LinkedIn, Indeed and Glassdoor postings. LinkedIn has no third-party search API and forbids scraping, so this is the legitimate route. Add further adapters in `src/lib/sources/index.ts`.

## Deploying

Needs a **long-running Node server with a persistent disk** — Railway, Render, Fly.io or a VPS. It will *not*
work on serverless hosts (Vercel, Netlify): the SQLite file would be wiped between invocations and the
in-process scheduler would never fire.

```bash
npm ci && npm run build && npm start
```

Required settings:

| Variable | Why |
|---|---|
| `DATABASE_PATH` | Point at a mounted volume, e.g. `/data/app.db`. Anything else is lost on redeploy. |
| `ADMIN_EMAILS` | Your email. **There is no default admin in production.** |
| `APP_URL` | Public URL — used in digest links and the Google OAuth callback. |

**Run exactly one instance.** The scheduler and rate limiter live in process, so a second instance would
double-hunt and halve the rate limits. To scale out, disable the in-process scheduler and drive
`POST /api/cron/hunt` (Bearer `CRON_SECRET`) from an external scheduler instead.

The demo account is not created in production unless `SEED_DEMO=true`; its password is published in this
repo, so treat any instance that enables it as public.

## Future categories

`opportunities.category` and `search_profiles.category` default to `job`. The agent, scoring and UI are category-agnostic apart from job-specific fields, so freelance/scholarship/grant sources can be added as new adapters later.
