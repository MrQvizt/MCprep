# MC PREPS — Malta meal prep platform

Website, order-request system and admin portal for **MC PREPS** ([@mcpreps.mt](https://www.instagram.com/mcpreps.mt/)),
a Malta-based macro-tracked meal prep business.

Customers browse meals and plans, see genuine time-limited offers, and send an **order request** (no online payment).
The business receives the order by email, follows up by WhatsApp/phone/email, and manages everything — meals,
prices, promotions, photos, SEO, blog, delivery areas — from the admin portal without a developer.

## Highlights

- **Premium black & white public site** — homepage, menu, plans & pricing, how it works, about, FAQ, contact,
  gallery, offers, blog, legal pages and four Malta-focused SEO pages; mobile-first; floating WhatsApp button.
- **Order requests** — plan pre-selected from the pricing cards, collection or delivery (only localities the owner
  enabled), allergy consent, server-side pricing, idempotent submission, permanent price snapshot, confirmation page,
  business + customer emails through a retrying outbox.
- **Promotions engine** — percentage or fixed discounts, caps, eligible plans, schedules in Malta time, automatic or
  coupon offers, total and per-customer limits, *new-customers-only* offers with privacy-safe eligibility checks,
  genuine countdown timers, reusable for Halloween, Black Friday, Christmas… and campaign landing pages.
- **Admin portal** — dashboard, orders (status history, notes, eligibility review, WhatsApp follow-up, CSV export),
  customers (GDPR export/anonymise), growth & performance from real data only, meals, plans, promotions, media library,
  Instagram gallery, page content editor, FAQs, testimonials (consent required), blog CMS, SEO & Google visibility
  (per-page SEO, quality assistant, redirects, sitemap), Google Business Profile & listings tracker, delivery areas &
  collection points, business settings, admin users & roles, activity log, site health, launch checklist.
- **Local SEO** — unique titles/descriptions, canonical URLs, Open Graph images, dynamic sitemap, robots, JSON-LD
  (Organization, LocalBusiness, WebSite, BreadcrumbList, BlogPosting, FAQPage), 301 redirects.
- **Privacy & security** — role-based access, rate limits, spam protection, sanitised content, cookieless first-party
  statistics, consent-gated GA4/GTM/Meta Pixel, audit log. No card data, no default credentials.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · PostgreSQL · Prisma 7 · Auth.js v5 ·
Zod 4 · React Hook Form · Resend · S3-compatible storage + sharp · Vitest · Playwright.

## Quick start (local)

Requirements: Node.js ≥ 20.9, PostgreSQL ≥ 14.

```bash
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`), `NEXT_PUBLIC_SITE_URL=http://localhost:3000`,
`EMAIL_TRANSPORT=console`, `STORAGE_DRIVER=local`.

```bash
npm install
npx prisma migrate deploy
npm run db:seed:demo
npm run admin:create -- --email you@example.com --name "Your Name" --role OWNER
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.

- `npm run db:seed` — **brand-safe** starter content: plans without prices ("price on request"), the Chicken Pokébowl
  (macros from the brand's Instagram — verify), FAQs to review, placeholder gallery tiles, a *draft* Halloween special,
  unconfirmed example localities, blog drafts. Use this for production.
- `npm run db:seed:demo` — same plus demo prices, a live 72-hour example promotion and three demo localities, for
  local preview and end-to-end tests only.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / build / serve |
| `npm run typecheck` · `npm run lint` | Type checking (with Next route types) · ESLint |
| `npm run test:unit` | Pure logic: pricing, discounts, rounding, time zones, eligibility, emails, redirects |
| `npm run test:integration` | Real Postgres (`TEST_DATABASE_URL`): orders, duplicates, snapshots, promotions, admin actions, SEO… |
| `npm run test:e2e` | Playwright on a production build (`E2E_DATABASE_URL`), desktop + mobile |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:studio` | Database tooling |
| `npm run admin:create` | Create an admin or reset a password (no default credentials exist) |

## Documentation

- [docs/OWNER-MANUAL.md](docs/OWNER-MANUAL.md) — plain-language guide for running the business from the admin.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel, database, email, storage, domain/HTTPS, cron, backups.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it works, data model, future Stripe integration.
- [docs/SECURITY-PRIVACY.md](docs/SECURITY-PRIVACY.md) — security measures, GDPR notes, items for legal review.

## What the business must supply before launch

The site never invents business facts. Placeholders stay empty or clearly marked until you add the real details:

- Real logo files (main, alternate, favicon, social image) — a text "MC PREPS" logo is used until then.
- Plan prices, meals included and inclusions; any further meals with verified nutrition and allergens.
- Order notification email, public email, phone and WhatsApp number.
- Delivery localities actually served (+ days, fees, minimum orders) and collection point details.
- The real promotion discount and deadline before enabling the Halloween special.
- Real food/kitchen photos and Instagram posts for the gallery.
- Reviewed privacy policy, terms, cookie policy and allergen wording.
- Provider credentials: PostgreSQL, Resend (+ verified domain), S3/R2 bucket, optional Google Analytics/Tag Manager,
  Search Console verification, Google Business Profile.

The admin **Launch checklist** tracks all of these.
