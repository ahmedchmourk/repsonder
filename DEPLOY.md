# Deploying Responder on Coolify

The repo ships a production `Dockerfile`, so Coolify needs the repository, a
PostgreSQL database, and a handful of environment variables.

## 1. Create the database

Coolify → **+ New** → **Database** → **PostgreSQL**.

Note the internal connection string it gives you — something like:

```
postgresql://postgres:PASSWORD@my-postgres:5432/postgres
```

Use the **internal** host (the service name), not the public one, so traffic
stays inside Coolify's network.

## 2. Create the application

Coolify → **+ New** → **Application** → your Git repository.

| Setting | Value |
| --- | --- |
| Build pack | **Dockerfile** |
| Dockerfile location | `/Dockerfile` |
| Port | `3000` |

Connect it to the database from step 1 so they share a network.

No volume is needed — all state lives in PostgreSQL.

## 3. Environment variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The internal PostgreSQL URL from step 1 |
| `APP_BASE_URL` | Your public URL, e.g. `https://responder.example.com` — **no trailing slash** |
| `ENCRYPTION_KEY` | 32+ random characters. Encrypts Google tokens and API keys. |
| `AUTH_SECRET` | 32+ random characters. Signs login sessions. |
| `CRON_SECRET` | 24+ random characters. Protects the background job endpoints. |
| `GOOGLE_REDIRECT_URI` | `https://responder.example.com/api/auth/callback/google` |
| `SEED_PASSWORD` | Password for the three seeded accounts. **Change this.** |

Generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # CRON_SECRET
```

Optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENABLE_CRON` | `true` | Set `false` to drive `/api/cron/*` from outside |
| `INGEST_CRON` | `15 3 * * *` | When to check for new reviews |
| `PUBLISH_CRON` | `*/15 * * * *` | How often due replies are sent |

> **Keep `ENCRYPTION_KEY` safe and unchanged.** Changing it makes every stored
> Google token and API key unreadable, and each organisation must be reconnected.

## 4. Sign-in accounts

On the first login attempt the app creates three accounts, each with
`SEED_PASSWORD`:

- `ahmed.chmourk@octicode.com`
- `kamal@octicode.com`
- `yaaqoub@octicode.com`

Existing accounts are never overwritten, so changing a password in the database
survives restarts. Passwords are stored as scrypt hashes, never plaintext.

## 5. Update the Google OAuth client

Once you know the public URL, add it in Google Cloud → **Clients** → your OAuth client:

- **Authorized JavaScript origins**: `https://responder.example.com`
- **Authorized redirect URIs**: `https://responder.example.com/api/auth/callback/google`

Then set the same URI in the app under **Setup → Advanced settings → Authorized
redirect URI**. It must match Google exactly, or you get `redirect_uri_mismatch`.

## 6. Deploy

Hit **Deploy**. On boot you'll see:

```
[responder] waiting for the database…
[responder] applying database schema…
[responder] starting server on 0.0.0.0:3000
[responder] scheduler started — ingest "15 3 * * *", publish "*/15 * * * *"
```

The entrypoint waits for PostgreSQL (up to 60s) and applies the schema, so a
cold start with a fresh database works without manual migration.

## Showing the UI without Google access

The whole interface is browsable before any Google approval — sign in and click
through every screen. Only live review data needs the Business Profile API
approval.

## Notes

- **One container only.** The scheduler runs in-process, so don't scale past one
  replica. For more, set `ENABLE_CRON=false` on all but one.
- **Health check**: `GET /login` returns 200 once the app is up.
- **Local development**: start PostgreSQL with
  `docker run -d --name responder-pg -e POSTGRES_PASSWORD=responder -e POSTGRES_USER=responder -e POSTGRES_DB=responder -p 5433:5432 postgres:16`,
  then `npm run db:push && npm run dev`.
