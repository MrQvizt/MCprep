# Security, privacy & compliance notes

> These notes describe how the software is built. They are **not legal advice**. The privacy policy, terms,
> cookie policy and allergen wording are templates that must be reviewed by the business owner and a
> qualified adviser before launch (the admin launch checklist tracks this).

## Personal data the website handles

| Data | Where | Purpose / lawful basis (to confirm with your adviser) |
| --- | --- | --- |
| Name, email, phone, WhatsApp | `Order`, `Customer`, `CustomerIdentity` | Handling the order request (pre-contractual steps / contract) |
| Delivery address, locality, postcode | `Order` | Delivering the order |
| Dietary preferences, allergies | `Order` (private) | Preparing food safely — allergy notes only with **explicit consent** (checkbox), timestamp stored in `allergyConsentAt` |
| Marketing opt-in | `MarketingConsent` (exact wording + time) | Consent, separate and unticked by default; never inferred from ordering |
| First-order checks | `Order.eligibility*`, `PromotionEligibilityReview` | Preventing abuse of first-order offers (legitimate interests) |
| Admin accounts | `AdminUser`, `AuditLog` | Security and accountability |

Not stored: payment card data (no payments online), raw IP addresses (rate-limit keys are salted hashes),
analytics identifiers (the built-in statistics are cookieless and anonymous).

## Data minimisation & access

- Optional fields can be switched off in **Business settings → Order form**.
- Only signed-in OWNER/ADMIN roles can see orders and customers; EDITORs see content only.
- The public confirmation page requires an unguessable token and shows no contact, address or allergy data.
- The customer confirmation email does not repeat allergy notes.
- Analytics events reject `/admin` paths and never include names, emails, phones, addresses or allergies.

## Retention & deletion

- Customers → **Anonymise** removes personal fields from the customer and their orders while keeping the
  pricing snapshot needed for accounting; consent and identity records are deleted. A JSON export supports access requests.
- Anonymous analytics events are deleted after ~13 months by the daily maintenance job.
- Decide and document your retention periods (e.g. orders for accounting, allergy notes) in the privacy policy;
  anonymise records once they are no longer needed.

## Cookies & tracking

- Essential: admin session cookie, consent preference cookie (`mcp_consent`).
- Built-in statistics: no cookies, no local storage, no identifiers.
- Optional (only when IDs are configured): Google Analytics 4, Google Tag Manager, Google Ads, Meta Pixel.
  **Nothing loads until the visitor accepts** in the consent banner; "Reject optional" is as prominent as
  "Accept all"; the choice can be changed from the footer ("Cookie settings").
- First-touch campaign attribution is stored in the browser session only with analytics consent; otherwise only
  the order page's own URL parameters are used.
- A banner alone does not guarantee compliance — review with your adviser (ePrivacy/GDPR, Maltese IDPC guidance).

## Third-party processors to list in the privacy policy

Hosting (e.g. Vercel), database (e.g. Neon/Supabase/AWS), email (Resend), image storage (e.g. Cloudflare R2/AWS S3),
optional analytics/advertising tools you enable, and optional Cloudflare Turnstile. Check where each stores data and
the safeguards for any transfer outside the EU/EEA.

## Application security

- **Authentication:** Auth.js credentials, bcrypt (cost 12) password hashes, 12+ character passwords, login rate
  limiting per email and IP, generic error messages, 8-hour sessions, httpOnly/secure cookies.
- **Authorisation:** server-side role checks in every admin page, action and API route; sessions are rechecked against
  the database on each request (deactivation, role changes and password resets take effect immediately via `sessionVersion`).
- **No default credentials:** the first owner is created with `npm run admin:create`.
- **CSRF:** Next.js Server Actions only accept same-origin requests; admin APIs require the session cookie
  (SameSite=Lax) and are mutation-safe.
- **XSS:** React escaping everywhere; rich text sanitised (allow-list) on save and render; JSON-LD escaped;
  email templates escape all customer input; CTA links restricted to internal paths or http(s).
- **SQL injection:** Prisma parameterised queries; the few raw queries use tagged templates (parameterised).
- **Uploads:** decoded with sharp (rejects non-images), max 10 MB, JPG/PNG/WebP/AVIF only (no SVG), re-encoded with
  metadata stripped, random storage keys, served with `nosniff` and a restrictive CSP.
- **Open redirects:** Instagram links validated to instagram.com; redirect rules validated (no loops, safe targets).
- **Spam/abuse:** honeypot, minimum completion time, per-IP rate limits, optional Turnstile, idempotent submissions.
- **Headers:** HSTS (production), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, permissions policy;
  admin pages are `noindex` and `no-store`; preview deployments send `X-Robots-Tag: noindex`.
- **Secrets:** only via environment variables; `.env*` files are git-ignored (except `.env.example`).
- **Audit log:** administrative changes (prices, promotions, statuses, settings, users, deletions) are recorded with actor and changes.

## Operational recommendations

- Enable database point-in-time recovery / daily backups and bucket versioning (see DEPLOYMENT.md).
- Use a dedicated sending domain with SPF/DKIM/DMARC for order emails.
- Give each staff member their own admin account with the lowest role they need; remove leavers promptly.
- Review the Activity log and Site health page regularly.
