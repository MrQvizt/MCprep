# Architecture

MC PREPS is a single Next.js application (frontend + backend) backed by PostgreSQL.

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Turbopack), TypeScript |
| Styling / UI | Tailwind CSS 4, shadcn/ui (Radix primitives), Lucide icons, self-hosted Archivo + Inter fonts |
| Database | PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg` driver adapter) |
| Auth | Auth.js v5 (credentials, JWT sessions) + database-verified sessions and role checks |
| Validation | Zod 4 (server actions, settings, content), React Hook Form on the order form |
| Email | Resend (transactional), through a database outbox with retries |
| Images | Local disk (dev) or any S3-compatible bucket (AWS S3, Cloudflare R2 …); processed with `sharp` |
| Tests | Vitest (unit + integration on a real Postgres), Playwright (end-to-end, desktop + mobile) |

## Directory layout

```
prisma/                 schema, migrations, seed (brand-safe) + seed content
scripts/create-admin.ts create or reset an admin account (no default credentials)
src/proxy.ts            Next.js 16 "proxy" (formerly middleware): 301 redirects + admin cookie check
src/app/(public)/       public website (homepage, menu, plans, SEO pages, blog, offers, order …)
src/app/admin/          admin portal (login + (dashboard)/… sections)
src/app/api/            auth, media upload, analytics events, cron, admin exports
src/components/         ui (shadcn), public, admin, shared, analytics, brand
src/lib/                domain logic — see below
tests/unit|integration|e2e
docs/                   this documentation
```

Key library modules (`src/lib`):

- `pricing.ts` — **pure pricing engine** (integer cents, basis-point percentages, half-up rounding, caps, eligible plans, redemption limits, coupon codes, no stacking). Fully unit tested.
- `orders/` — order schema (shared by browser + server), eligibility classification, the transactional `createOrderRequest` service, labels.
- `promotions/` — loading live promotions, public view models, `{discount}`/`{ends}` copy tokens.
- `settings/` and `content/` — typed, zod-validated JSON settings and page content with safe defaults.
- `email/` — templates (HTML-escaped), transport (Resend/console), outbox with retry/backoff.
- `seo/` — page registry, metadata builder (canonical, Open Graph, robots), JSON-LD builders, sitemap, quality checks.
- `auth.ts` / `authz.ts` — Auth.js configuration; `requireAdmin` (pages) and `assertAdmin` (actions/APIs).
- `storage/`, `images.ts`, `media.ts` — uploads: validation by decoding, EXIF stripping, resizing, WebP output.
- `redirects.ts` / `redirect-rules.ts` — owner-managed 301s with loop/chain detection.
- `rate-limit.ts` — Postgres-backed fixed-window limiter (works across serverless instances).
- `time.ts` — Europe/Malta conversions without external libraries (DST-safe, tested).

## Rendering & caching

Cache Components is **off**; public pages render dynamically per request (data layer calls `connection()`), so
admin edits, prices and promotion expiry are reflected immediately and builds never need database access.
Admin mutations also call `revalidatePath("/", "layout")` to clear the browser router cache. Countdown timers
are client components that tick against the **server's** clock (skew-corrected) and refresh the page at zero; the
server enforces every deadline independently.

## Orders

1. The browser submits the form to a server action (`submitOrderAction`) with a client-generated idempotency key.
2. Rate limits, honeypot, minimum fill time and optional Cloudflare Turnstile are checked.
3. `createOrderRequest` runs one database transaction that:
   - locks promotions with a total redemption limit (`SELECT … FOR UPDATE`) to prevent overselling,
   - prices the order on the server (`quoteForOrder` → `computeQuote`),
   - matches the customer by canonical email (`+tags` and Gmail dots removed) and E.164 phone,
   - classifies first-order eligibility (`classifyEligibility`) — stored on the order, **never shown to the customer**,
   - allocates a human reference (`MCP-000123`) from the order sequence,
   - stores the **permanent pricing snapshot** (plan, base price, discount, fees, total, promotion terms),
   - writes status history, promotion redemption, eligibility review, marketing consent, attribution,
   - enqueues the business + customer emails in the outbox (same transaction).
4. After commit, emails are sent best-effort (`after()`); failures stay in the outbox and are retried
   (1, 5, 15, 60 minutes … up to 24 hours) by the cron job and on admin page loads. Resend idempotency keys
   prevent duplicates on retry.
5. The customer is redirected to `/order/confirmation?ref=…&t=…`. The token is an HMAC of the order id; the
   reference alone reveals nothing. The page shows no contact details, address or allergy notes.

Re-submitting the same idempotency key (double click, network retry, concurrent requests) returns the original order.

### First-time customer offers

No accounts exist, so eligibility is **preliminary**. The quote shown to customers never depends on their
identity (so the form cannot be used to discover whether an email or phone is known). New-customer discounts
require the customer's declaration and are always labelled "subject to verification". The team approves or
rejects in the admin; decisions are audit-logged. Returning customers can always order at the normal price.

## Payment boundary (future Stripe)

Payment is deliberately separate from fulfilment:

- `Order.status` (NEW → CONTACTED → CONFIRMED → IN_PREPARATION → COMPLETED / CANCELLED) is operational.
- `Order.paymentStatus` (`NOT_COLLECTED` today; `PENDING`, `PAID`, `REFUNDED`, …) plus `paymentProvider`,
  `paymentReference`, `paidAmountCents`, `paidAt` hold payment facts.
- Amounts are integer cents with an explicit `currency`; `confirmedTotalCents` records the agreed price.

To add Stripe later: create a Checkout Session (or Payment Link) from the confirmed order using
`confirmedTotalCents ?? totalCents`, store the session id in `paymentReference`, set `paymentStatus = PENDING`,
and handle the `checkout.session.completed` webhook to set `PAID`/`paidAt`. No pricing or order code needs
to change. Card data never touches this application.

## Security model (summary)

- Every admin page calls `requireAdmin(role)`; every action/API calls `assertAdmin(role)` — the proxy cookie
  check is only a convenience. Sessions are re-validated against the database (active flag + session version).
- Roles: OWNER (everything, incl. admin users), ADMIN (everything else), EDITOR (content, media, SEO, blog).
- All input is validated with zod; rich text is sanitised on save and on render; JSON-LD is escaped.
- Uploads are decoded and re-encoded (no SVG), size-limited, stored under random keys.
- Rate limits: login (per email + IP), order submission, quotes, analytics events, uploads.
- See [SECURITY-PRIVACY.md](./SECURITY-PRIVACY.md).

## Data model highlights

- `Order` keeps snapshots and never depends on live content; plans/meals referenced by orders are archived, not deleted (`onDelete: SetNull` on references).
- `Customer` + `CustomerIdentity(type, value)` unique pairs give one record per person without fragmenting history.
- `Promotion`, `PromotionEligiblePlan`, `PromotionRedemption`, `PromotionEligibilityReview`, `PromotionSelectedCustomer`.
- `SiteSetting` / `PageContent` store validated JSON; `SEOPageMetadata` overrides per page; `RedirectRule`.
- `EmailOutbox`, `AuditLog`, `AnalyticsEvent` (cookieless, no personal data), `TrackingAttribution`, `MarketingConsent`.
- `SiteHealthCheck`, `ChecklistItemState`, `BusinessListing`, `DeliveryArea`, `CollectionPoint`, `Testimonial`, `BlogPost`, `BlogCategory`, `GalleryItem`, `MediaAsset`.
- All timestamps are `timestamptz` (UTC); the business time zone (Europe/Malta) is applied when rendering.

## Localisation

English (`en-MT`), EUR, +356 phone defaults, Malta postcodes. Copy lives in `PageContent`/settings rather than
in components, so a Maltese version can be added later with per-language content keys, `/mt/…` routes and
`hreflang` alternates — no automatic machine translation is used.
