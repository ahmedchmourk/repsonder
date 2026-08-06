# Responder

Automates replies to Google Business Profile reviews, for **one or many
businesses**. Reviews are pulled on a 24-hour cycle, classified by star rating and
sensitivity, and routed one of three ways:

| Rating | Behaviour | Status |
| --- | --- | --- |
| 4.0 – 5.0★ | Positive reply generated and published automatically once the 24h hold elapses | `SCHEDULED` → `PUBLISHED` |
| 3.0 – 3.9★ | Draft generated, waits for human sign-off in the Approvals queue | `PENDING_APPROVAL` |
| 1.0 – 2.9★ **or** sensitive content | **No public draft is generated at all** — a human writes the reply | `NEEDS_HUMAN_ATTENTION` |

Sensitivity is detected by a keyword pre-filter (legal threats, discrimination,
health/safety, fraud, privacy, death) *and* an LLM judgement. Either signal
escalates — the pipeline fails safe towards a human.

## Businesses

Every business owns its credentials and its own voice. Nothing about Google or
the LLM lives in `.env`:

| Per business | Why |
| --- | --- |
| Google OAuth client ID + secret | Each business authorises its own Google account |
| LLM provider, model and API key | Billing and rate limits stay separate |
| **Business context** | Free text: services, prices, hours, policies |
| Tone, signature, reply delay, auto-publish | Voice and pacing per brand |

The **business context** is the feature that makes replies safe. It is injected
into every reply prompt as the *only* source of facts the model may use, and the
prompt forbids inventing anything absent from it. Ask about a service the business
doesn't offer and the reply declines gracefully instead of hallucinating one.

Create a business on first run (or via the switcher → **Add a business**), enter
the three credentials plus the context, connect its Google account, and it starts.
The switcher in the header changes which business the dashboard shows; the cron
jobs always process **every** active, connected business regardless of that.

Reviews, drafts, locations, logs and cron runs are all scoped by business —
deleting a business cascades to all of it.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + Radix UI primitives (shadcn-style components)
- Design tokens shared with the OctiScraper project: oklch colour space, lime-green
  primary, Syne headings over Montserrat body text, 0.75rem base radius, glass
  header. Light and dark themes ship together — the header toggle stores the
  choice in `localStorage` and an inline script applies it before first paint.
- Prisma + SQLite (real local database — no mock data anywhere)
- `googleapis` for OAuth and location metadata; Google My Business API **v4**
  over `fetch` for reviews and replies (v4 is the only version that exposes them)
- OpenAI or Google Gemini for drafting
- `node-cron`, booted once per server process from the root layout

## Interface

The whole UI is **one page**. Buttons in the dashboard switch between four
panels, and the active panel is the only one whose data is queried:

| Button | URL | Shows |
| --- | --- | --- |
| Auto-Replied | `/` | 4.0–5.0★, scheduled or already published |
| Needs Approval | `/?view=approvals` | 3.0–3.9★ drafts, editable inline |
| Action Required | `/?view=escalations` | 1.0–2.9★ and sensitive, manual composer |
| Settings | `/?view=settings` | Google connection, cron status, LLM config |

Views are plain links, so they stay deep-linkable — the OAuth callback returns
straight to `/?view=settings`.

## Layout

```
tailwind.config.ts            Design tokens (colours, fonts, radii) — the theme lives here
src/app/globals.css           oklch CSS variables for light/.dark, glass + glow utilities
src/app/page.tsx              The entire dashboard: stats, view switcher, all four panels
src/lib/views.ts              The four view keys + `?view=` parsing
src/lib/business.ts           Business CRUD, cookie-based selection, credential decryption
prisma/schema.prisma          Business, OAuthAccount, Location, Review, Draft, CronRun, ActivityLog
src/lib/google.ts             OAuth 2.0 (offline access), locations, review fetch, reply publish
src/lib/llm.ts                Sensitivity analysis + reply generation (OpenAI / Gemini)
src/lib/pipeline.ts           Ingest → route → schedule → publish, plus the human actions
src/lib/scheduler.ts          node-cron jobs (ingest daily, publisher every 15 min)
src/lib/crypto.ts             AES-256-GCM for refresh tokens and API keys at rest
src/app/api/                  OAuth, cron, job triggers, review actions, settings
```

## Timing

Two separate guarantees keep replies from looking robotic:

1. **Ingest** runs once every 24 hours (`INGEST_CRON`).
2. Every reply carries a `scheduledFor` of `ingestedAt + MIN_REPLY_DELAY_HOURS`
   (minimum and default 24h, enforced in code — the setting cannot go lower).
   The publisher job only sends replies whose `scheduledFor` has passed.

Approving a draft in the UI respects that floor: if 24h has not yet elapsed the
reply is queued rather than sent, and the button tells you when it will go out.
A "Publish now (override delay)" action exists for the cases where an operator
deliberately wants it immediately. Manual replies to escalated reviews publish
straight away — a person wrote them, and slow responses to serious complaints
make things worse.

## Setup

See `SETUP.md` for the full step-by-step checklist (Google Cloud, OAuth consent
screen, database, API keys, running locally).

Short version:

```bash
npm install
cp .env.example .env     # then fill in the values
npm run db:push
npm run dev
```

## External scheduler

Set `ENABLE_CRON=false` to disable the in-process scheduler and drive the
pipeline yourself:

```bash
curl -X POST http://localhost:3000/api/cron/ingest  -H "x-cron-secret: $CRON_SECRET"
curl -X POST http://localhost:3000/api/cron/publish -H "x-cron-secret: $CRON_SECRET"
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run db:push` | Apply `schema.prisma` to the SQLite file |
| `npm run db:studio` | Browse the database in Prisma Studio |
