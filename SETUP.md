# Responder — setup checklist

Work through these in order. Steps 1–3 are the slow part (Google's approval can
take days); steps 4–7 take about five minutes.

---

## 1. Google Cloud project & API access

- [ ] **1.1** Go to <https://console.cloud.google.com/> and create a project (e.g. `responder-local`).

- [ ] **1.2** **Request access to the Business Profile APIs.** This is the step people
      miss, and nothing else works without it. The Google My Business APIs are
      access-restricted: until Google approves your project you will not even see
      them in the API Library, and calls return `403 PERMISSION_DENIED` /
      `SERVICE_DISABLED`.
      Submit the form here: <https://developers.google.com/my-business/content/prereqs#request-access>
      You need to supply your GCP **project number**, the Google account that
      manages the business, and a short description of your use case.
      Approval typically takes a few business days.

- [ ] **1.3** Once approved, enable these three APIs (APIs & Services → Library):
      - **Google My Business API** (`mybusiness.googleapis.com`) — this is the legacy
        v4 API and the **only** one that exposes reviews and replies.
      - **My Business Account Management API** (`mybusinessaccountmanagement.googleapis.com`) —
        lists the accounts you manage.
      - **My Business Business Information API** (`mybusinessbusinessinformation.googleapis.com`) —
        lists locations.

- [ ] **1.4** Confirm the Google account you will connect actually has **owner or
      manager** access to at least one verified Business Profile location at
      <https://business.google.com/>. An account with no locations will connect
      fine but ingest nothing.

## 2. OAuth consent screen

- [ ] **2.1** APIs & Services → **OAuth consent screen**.

- [ ] **2.2** User type:
      - **Internal** if you have a Google Workspace org — simplest, no verification.
      - **External** otherwise. Leave it in **Testing** status for local development.

- [ ] **2.3** Fill in the app name (`Responder`), your support email, and a developer
      contact email.

- [ ] **2.4** **Scopes** → Add scope → paste:
      ```
      https://www.googleapis.com/auth/business.manage
      ```
      (The app also requests `openid` and `email`, purely to display which account
      is connected.)

- [ ] **2.5** **Test users** → add the Google account that manages the business
      profile. In Testing mode, only listed accounts can complete the flow.

> ⚠️ **Testing-mode caveat:** refresh tokens issued by an app in Testing status
> expire after **7 days**. When background jobs start failing with
> `invalid_grant`, press **Re-authorize** on the Settings page. Publishing the app
> (or using an Internal Workspace app) removes this limit. `business.manage` is a
> sensitive scope, so publishing an External app requires Google verification.

## 3. OAuth client credentials

- [ ] **3.1** APIs & Services → **Credentials** → Create credentials → **OAuth client ID**.

- [ ] **3.2** Application type: **Web application**. Name it `Responder local`.

- [ ] **3.3** **Authorized JavaScript origins** → add:
      ```
      http://localhost:3000
      ```

- [ ] **3.4** **Authorized redirect URIs** → add **one** of these. The app serves
      both, so pick whichever you prefer (a trailing slash, different port, or
      swapped path segments all cause `redirect_uri_mismatch`):
      ```
      http://localhost:3000/api/auth/google/callback
      http://localhost:3000/api/auth/callback/google
      ```
      Then type the same one into the **Authorized redirect URI** field in the
      app's Settings panel — the two must match exactly. The field offers both as
      one-click options.

- [ ] **3.5** Copy the **Client ID** and **Client secret**.

> **Where credentials go:** the Google client ID/secret and the LLM key are **not**
> put in `.env`. You enter them when you create the business in the app, and they
> are encrypted before being stored. `.env` only holds `DATABASE_URL`,
> `APP_BASE_URL`, `ENCRYPTION_KEY`, `CRON_SECRET` and the cron schedules.

## 4. LLM API key

Pick one provider (you can switch later on the Settings page).

- [ ] **4.1a** **OpenAI** — create a key at <https://platform.openai.com/api-keys>.
      Default model: `gpt-4o-mini`. Make sure the account has billing credit;
      a key with no credit returns `insufficient_quota`.

- [ ] **4.1b** **Google Gemini** — create a key at <https://aistudio.google.com/apikey>.
      Default model: `gemini-2.0-flash`.

You can either put the key in `.env` or paste it into the Settings page, where it
is encrypted with `ENCRYPTION_KEY` before being written to the database. A key
set in the UI takes precedence over `.env`.

## 5. Local environment

- [ ] **5.1** Install dependencies (already done if you are reading this in the
      generated project):
      ```bash
      npm install
      ```

- [ ] **5.2** A `.env` already exists with a freshly generated `ENCRYPTION_KEY` and
      `CRON_SECRET`. If you need to recreate it, copy `.env.example` to `.env` and
      generate the two secrets:
      ```bash
      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
      node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # CRON_SECRET
      ```

- [ ] **5.3** Check the redirect URI matches what you registered in step 3.4:
      ```ini
      GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
      ```
      Every business shares this URI — each one has its own client ID behind it.

- [ ] **5.4** Nothing else goes in `.env`. The Google client ID/secret, the LLM
      key, the business context, the tone and the reply delay are all entered per
      business in the app (step 7.2).

> **Do not lose `ENCRYPTION_KEY`.** It decrypts every stored refresh token, client
> secret and API key. If you change it you must re-enter all of them.

## 6. Database

The project uses **SQLite via Prisma** — no server to install. The database file
lives at `prisma/responder.db`.

- [ ] **6.1** Create/update the schema (already run once during setup):
      ```bash
      npm run db:push
      ```

- [ ] **6.2** Optional — browse the data:
      ```bash
      npm run db:studio
      ```

- [ ] **6.3** Optional — start over from scratch:
      ```bash
      rm prisma/responder.db && npm run db:push
      ```

<details>
<summary>Using PostgreSQL instead</summary>

1. Run Postgres: `docker run --name responder-pg -e POSTGRES_PASSWORD=responder -p 5432:5432 -d postgres:16`
2. In `prisma/schema.prisma`, change the datasource provider to `postgresql`.
3. In `.env`: `DATABASE_URL="postgresql://postgres:responder@localhost:5432/responder?schema=public"`
4. `npm run db:push`

No application code changes are needed — the schema avoids SQLite-specific
features (enums are stored as strings, which works on both).
</details>

## 7. Run it

- [ ] **7.1** Start the dev server:
      ```bash
      npm run dev
      ```
      Open <http://localhost:3000>. On a fresh database you land on the
      **create business** form.

- [ ] **7.2** Create the business. You need four things:
      - **Name** — e.g. OctiGrowth
      - **Business context** — what it does, services, prices, hours, policies,
        and anything the AI must never promise. This is the *only* source of facts
        the AI may use in a reply, so be specific. Minimum 40 characters.
      - **Google client ID + secret** from step 3.5
      - **LLM provider + API key** from step 4

      Both secrets are encrypted before they are stored, and are never sent back
      to the browser afterwards.

      To manage more businesses later, use the business switcher in the header →
      **Add a business**. Each one keeps its own credentials, context and reviews.

- [ ] **7.3** Press **Connect Google account**, complete the consent screen, and
      grant the "Manage your Business Profile" permission. On the way back the app
      stores the refresh token (encrypted) and syncs the locations. Then press
      **Test connection** to confirm the LLM responds (`provider · model`).

- [ ] **7.4** Press **Run ingest**. Watch *Recent runs* and *Activity* fill in.
      Reviews then appear under the three review buttons.

- [ ] **7.5** Check the routing worked as expected:
      - **Auto-Replied** — 4.0–5.0★, each with a draft and a scheduled publish time
        24 hours after ingestion.
      - **Needs Approval** — 3.0–3.9★ drafts. Edit inline, then **Approve & Publish**.
      - **Action Required** — 1.0–2.9★ and anything flagged sensitive, with **no**
        generated draft and a manual reply composer.

- [ ] **7.6** Leave the server running. The in-process scheduler fetches once a day
      (`INGEST_CRON`, default 03:15) and checks for due replies every 15 minutes
      (`PUBLISH_CRON`). Both sweep **every** active, connected business — the
      switcher only changes what the dashboard displays.

- [ ] **7.7** Production mode:
      ```bash
      npm run build && npm start
      ```

---

## First-run expectations

- The very first ingest brings in your **existing** reviews. Reviews that already
  have a reply on Google are recorded as published so Responder never replies
  twice.
- Nothing is published for at least 24 hours after ingestion. To see the publish
  path immediately, use **Publish now (override delay)** on an approval card.
- The 24-hour floor is enforced in code: `minReplyDelayHours` cannot be set below
  24 (the API returns 400 and `getSettings()` clamps it).

## Driving the cron from outside the app

Set `ENABLE_CRON=false` in `.env`, restart, then call the endpoints yourself:

```bash
curl -X POST http://localhost:3000/api/cron/ingest  -H "x-cron-secret: $CRON_SECRET"
curl -X POST http://localhost:3000/api/cron/publish -H "x-cron-secret: $CRON_SECRET"
```

The secret is also accepted as `Authorization: Bearer …` or `?secret=…`.
Windows Task Scheduler, `crontab`, QStash, and GitHub Actions all work.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `redirect_uri_mismatch` | The URI in the app's **Authorized redirect URI** field must match the one registered in Google Cloud character for character — including the port, no trailing slash, and the order of the path segments (`/api/auth/google/callback` and `/api/auth/callback/google` are different URIs; the app serves both, Google only accepts what you registered). |
| `403 PERMISSION_DENIED` / `SERVICE_DISABLED` on ingest | Step 1.2 (API access request) is not approved yet, or one of the three APIs in 1.3 is not enabled. |
| Connected, but "0 locations found" | The Google account isn't an owner/manager of a verified location, or the Business Information API is not enabled. |
| `invalid_grant` after about a week | Testing-mode refresh tokens expire in 7 days. Press **Re-authorize** on Settings. |
| `Refresh token: Missing` | Google only issues one on first consent. Press **Re-authorize** — the app forces `prompt=consent` to get a new one. |
| `LLM_NOT_CONFIGURED` | No key for the selected provider. Check that the provider dropdown matches the key you entered. |
| `insufficient_quota` from OpenAI | The key is valid but the account has no billing credit. |
| Gemini `429 … limit: 0` | That model has no free-tier quota on your key. `gemini-flash-latest` works where `gemini-2.0-flash` returns 0 — change the model in Settings. |
| Reply truncated mid-sentence | Gemini "latest" models spend output tokens on hidden reasoning (~680 for a short reply). Responder allows 3072 and rejects truncated responses; if you lower the limit in code this returns. |
| Every page 500s with "no such table" | Run `npm run db:push`. |
| `ENCRYPTION_KEY is missing or shorter than 32 characters` | Set it in `.env` and restart. |
| Scheduler never runs | `ENABLE_CRON=false`, an invalid cron expression, or a missing `CRON_SECRET` (the in-process scheduler calls the protected endpoints). Check the terminal output. |
