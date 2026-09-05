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
- **Payments**: `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`, then implement checkout + webhook in `startUpgrade()` (`src/app/actions.ts`). Nothing is simulated; admins can set plans manually at `/admin`.
- **Live job listings**: `RAPIDAPI_KEY` enables the JSearch adapter (`src/lib/sources/jsearch.ts`) — a licensed aggregator that includes LinkedIn, Indeed and Glassdoor postings. LinkedIn has no third-party search API and forbids scraping, so this is the legitimate route. Add further adapters in `src/lib/sources/index.ts`.

## Future categories

`opportunities.category` and `search_profiles.category` default to `job`. The agent, scoring and UI are category-agnostic apart from job-specific fields, so freelance/scholarship/grant sources can be added as new adapters later.
