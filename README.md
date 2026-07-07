# RevenueOS Enterprise

The AI Revenue Operating System that Finds, Qualifies, Nurtures, Closes, and Grows Customers.

This repo is the standalone iTechSmart RevenueOS Enterprise preview. It is built as a Next.js 15 / React 19 app with a dense operating dashboard as the first screen.

## What is included

- Metric island for meetings, calls, revenue, pipeline, lead heat, campaigns, tasks, forecast, and customer health.
- AI Sales Agent morning briefing for Kevin.
- CRM intelligence table with fit, intent, authority, urgency, and overall lead score.
- SpringCode revenue flow from Search to Expand.
- AI workbench for research, cold email, meeting prep, call notes, and proposal actions.
- Campaign automation and customer portal/integration surface.
- Codespaces-ready `.devcontainer`.
- GitHub Actions CI for typecheck and production build.
- Postgres schema migration for core CRM, campaign, lead scoring, RBAC-ready users/roles, and audit events.
- Authenticated API routes for CRM companies, contacts, deals, tasks, campaigns, lead scoring, audit events, health, AI meeting prep, and proposal generation.
- Clerk SSO integration for app sessions, plus JWKS/OIDC bearer-token fallback for machine/API clients.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run typecheck
npm run build
```

## Production services

Copy `.env.example` into the deployment environment and configure real service values. The API fails closed when required production services are missing.

- `DATABASE_URL` for Postgres.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` for Clerk SSO.
- `AUTH_JWKS_URL`, `AUTH_ISSUER`, and `AUTH_AUDIENCE` for OIDC/JWT verification.
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` for AI meeting prep and proposal generation.

Apply `migrations/001_revenueos_core.sql` to the production database before enabling the API.

See `docs/COMPLETION-MATRIX.md` for the exact completion status and acceptance gates.
