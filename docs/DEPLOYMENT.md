# Deployment guide

The recommended setup is **Vercel** (hosting) + a managed **PostgreSQL** database (Neon, Supabase or AWS RDS, EU
region) + **Resend** (email) + **Cloudflare R2** or **AWS S3** (images). Any Node.js ≥ 20.9 host works.

## 1. Accounts and services you need

| Service | Why | What to collect |
| --- | --- | --- |
| PostgreSQL (EU region, e.g. Frankfurt) | Orders, content, settings | `DATABASE_URL` (pooled connection string) |
| Resend | Order notification + confirmation emails | `RESEND_API_KEY`, a verified sending domain, `EMAIL_FROM` |
| Cloudflare R2 / AWS S3 | Uploaded photos (Vercel's disk is read-only) | bucket, endpoint, access key, secret, public URL |
| Domain registrar | Your web address (e.g. `mcpreps.mt` / `mcpreps.com`) | DNS access |
| Vercel | Hosting, HTTPS, cron | — |

## Quick path: Vercel + Supabase integration

If the Supabase database is connected to the Vercel project through the official integration, the database
variables (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, …) are added automatically and **no
`DATABASE_URL` is needed**. Every deploy then:

1. applies pending database migrations (`prisma migrate deploy` — never resets or deletes data),
2. on the very first deploy only, adds the brand-safe starter content,
3. builds the site (`npm run vercel-build`, run automatically by Vercel).

Add these variables in Vercel → Settings → Environment Variables, then redeploy:

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | output of `openssl rand -base64 32` (required for admin sign-in) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | your owner login (password ≥ 12 characters). Created on the next deploy; remove these variables after you've signed in and changed your password |
| `NEXT_PUBLIC_SITE_URL` | your final domain once you have it (until then the Vercel URL is used) |
| `CRON_SECRET` | output of `openssl rand -hex 24` |
| `RESEND_API_KEY`, `EMAIL_FROM` | order emails (they wait in the queue until configured) |
| `STORAGE_DRIVER=s3` + `S3_*` + `MEDIA_PUBLIC_BASE_URL` | photo uploads (Supabase Storage's S3 endpoint, Cloudflare R2 or AWS S3) |

**Using a Supabase connection string directly** (instead of the integration): set `DATABASE_URL` to the
**Session pooler** string (`…pooler.supabase.com:5432/postgres?sslmode=require`). Migrations use it as given; the
app automatically switches to Supabase's transaction pooler (port 6543), which is built for serverless functions —
session mode only allows ~15 simultaneous connections and runs out quickly. Functions run in Dublin (`dub1`, set in
`vercel.json`), next to Supabase's `eu-west-1` region; change both together if your database lives elsewhere.

Preview deployments use the same database unless you give them their own, so test on previews with care.
Set `SKIP_DB_MIGRATIONS=1` on an environment to stop automatic migrations there.

## 2. Configure environment variables

Copy every variable from `.env.example` into **Vercel → Project → Settings → Environment Variables** (Production,
and Preview with a separate database). Minimum for production:

```
DATABASE_URL, NEXT_PUBLIC_SITE_URL, AUTH_SECRET, CRON_SECRET,
EMAIL_TRANSPORT=resend, RESEND_API_KEY, EMAIL_FROM,
STORAGE_DRIVER=s3, S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, MEDIA_PUBLIC_BASE_URL
```

Generate secrets with `openssl rand -base64 32` (AUTH_SECRET) and `openssl rand -hex 24` (CRON_SECRET).
`MEDIA_PUBLIC_BASE_URL` must be the public URL that serves the bucket (R2 public bucket/custom domain, CloudFront…);
it is added to the allowed image hosts automatically at build time.

Preview deployments are automatically `noindex` (they use `VERCEL_ENV=preview`). Set `ALLOW_INDEXING=false` on any
staging host that is not Vercel.

## 3. Database

```bash
# apply migrations (run from CI or locally against the production URL)
DATABASE_URL="…production…" npx prisma migrate deploy

# brand-safe starter content (no invented prices, areas or promotions)
DATABASE_URL="…production…" npm run db:seed

# create the first owner account (asks for a password, min 12 characters)
DATABASE_URL="…production…" npm run admin:create -- --email you@yourdomain.com --name "Your Name" --role OWNER
```

Never run `npm run db:seed:demo` against production — it adds demo prices, a live example promotion and demo localities.

On Vercel you can make migrations part of the build by setting the build command to
`npx prisma migrate deploy && npm run build`.

## 4. Email (Resend)

1. Add your domain in Resend and create the DNS records it shows (SPF, DKIM; add a DMARC record too).
2. Set `EMAIL_FROM`, e.g. `MC PREPS <orders@yourdomain.com>`.
3. In the admin: **Business settings → Contact** add the order notification inbox(es); then use **Send test email**.
4. Order emails are written to an outbox first; if Resend is down they are retried automatically.

## 5. Images (Cloudflare R2 example)

1. Create a bucket (e.g. `mcpreps-media`), enable public access through a custom domain (e.g. `media.yourdomain.com`).
2. Create an API token with Object Read & Write for that bucket.
3. Set `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`,
   `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_BASE_URL=https://media.yourdomain.com`.

For AWS S3 leave `S3_ENDPOINT` empty, set the region, and serve through CloudFront or a public-read bucket policy.

## 6. Scheduled jobs

`vercel.json` runs `/api/cron/daily` once a day (sends queued email, cleans up, runs the site health check). Vercel
sends `Authorization: Bearer $CRON_SECRET` automatically.

Emails are also sent immediately after each order and retried whenever an admin opens the portal. On a paid Vercel
plan (or with an external scheduler such as cron-job.org / GitHub Actions) also call `/api/cron/outbox` every 5–15
minutes with the header `Authorization: Bearer <CRON_SECRET>`.

## 7. Domain & HTTPS

1. Vercel → Project → Domains → add `www.yourdomain.com` and the apex; follow the DNS instructions.
2. HTTPS certificates are issued automatically; HSTS is sent in production.
3. Set `NEXT_PUBLIC_SITE_URL` to the final https URL (no trailing slash) and redeploy — canonical URLs, the sitemap,
   social previews and email links depend on it.
4. Pick one primary host (with or without `www`) and let Vercel redirect the other.

## 8. Going live with Google

1. Admin → **Google & listings**: add the Search Console verification code, verify the property, submit
   `https://yourdomain/sitemap.xml`.
2. Claim/verify your Google Business Profile and work through the checklist.
3. Turn off the preview notice: **Business settings → Website**.
4. Work through **Launch checklist** until everything is green.

## 9. Backups & recovery

- **Database:** enable automatic backups / point-in-time recovery in your provider (Neon and Supabase include it;
  check the retention period). Additionally take a weekly logical backup:
  `pg_dump --format=custom "$DATABASE_URL" > mcpreps-$(date +%F).dump` and store it off-site (encrypted).
- **Restore drill:** `pg_restore --clean --no-owner -d "$TARGET_DATABASE_URL" mcpreps-YYYY-MM-DD.dump` into a new
  database, point a preview deployment at it, and check orders and content. Do this at least once before launch.
- **Images:** enable object versioning / lifecycle rules on the bucket, or sync it periodically
  (`rclone sync r2:mcpreps-media backup:mcpreps-media`).
- **Configuration:** keep a copy of environment variables in a password manager.

## 10. Local development

```bash
cp .env.example .env            # fill DATABASE_URL, AUTH_SECRET …
npm install                      # also generates the Prisma client
npx prisma migrate deploy        # or: npm run db:migrate (creates new migrations during development)
npm run db:seed:demo             # demo prices + live example promotion for local preview
npm run admin:create -- --email you@example.com --name "You"
npm run dev                      # http://localhost:3000 and /admin
```

## 11. Continuous integration (suggested)

```bash
npm ci
npm run typecheck && npm run lint
npm run test:unit
TEST_DATABASE_URL=… npm run test:integration   # disposable Postgres
E2E_DATABASE_URL=… npm run test:e2e            # builds the app, uses Playwright
```
