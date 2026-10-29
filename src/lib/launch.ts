import "server-only";
import { db } from "@/lib/db";
import { getContent } from "@/lib/content";
import { emailTransport, env, indexingAllowed } from "@/lib/env";
import { normalizePhone } from "@/lib/identity";
import { getSettings } from "@/lib/settings";
import { getSitemapEntries } from "@/lib/seo/sitemap";
import { DEFAULT_TIME_ZONE, zonedParts } from "@/lib/time";
import { isInstagramUrl } from "@/lib/urls";

export type LaunchStatus = "done" | "todo" | "warning";

export interface LaunchItem {
  key: string;
  title: string;
  description: string;
  status: LaunchStatus;
  /** Detected automatically (true) or ticked by the owner (false). */
  auto: boolean;
  href: string;
  hrefLabel: string;
  detail?: string;
  doneAt?: Date | null;
}

export interface ChecklistDefinition {
  key: string;
  title: string;
  description: string;
  href?: string;
}

// ── Manual checklists ───────────────────────────────────────────────────────

export const LAUNCH_MANUAL_ITEMS: ChecklistDefinition[] = [
  {
    key: "promo_eligibility_tested",
    title: "First-order promotion tested",
    description:
      "Submit a test order with the first-order offer using a new email, then again with the same email, and check the second one is flagged as a returning customer in Orders.",
    href: "/admin/orders",
  },
  {
    key: "sitemap_submitted",
    title: "Sitemap submitted in Google Search Console",
    description: "In Search Console → Sitemaps, submit your sitemap address (shown on the Google & listings page).",
    href: "/admin/listings",
  },
  {
    key: "backups_confirmed",
    title: "Database backups switched on",
    description: "Check with your developer or database provider that automatic daily backups are enabled and can be restored.",
  },
  {
    key: "legal_adviser_review",
    title: "Policies reviewed by an adviser",
    description: "Privacy policy, terms and cookie policy reviewed by a qualified adviser (GDPR and Maltese requirements).",
    href: "/admin/content",
  },
];

export const GBP_ITEMS: ChecklistDefinition[] = [
  { key: "claim", title: "Create or claim your Google Business Profile", description: "Go to business.google.com and search for MC PREPS. Claim it if it exists, otherwise create it." },
  { key: "verify", title: "Verify that you own the business", description: "Google sends a code by phone, email, video or post. Your profile only appears publicly once verified." },
  { key: "category", title: "Choose the right primary category", description: "Pick the category that best describes what you actually do (for example a meal delivery or meal prep category). Avoid categories for services you don't offer." },
  { key: "services", title: "Add your services", description: "List your real services: meal plans, collection, delivery." },
  { key: "service_areas", title: "Add the areas you deliver to", description: "Add only the localities you really serve. If you don't have a shop customers visit, hide your address and use service areas instead." },
  { key: "phone", title: "Add your business phone number", description: "Use the same number as on this website so your details are consistent." },
  { key: "website", title: "Add your website address", description: "Link to your homepage. If Google offers an ordering link, use your order page." },
  { key: "hours", title: "Add your operating hours", description: "Only real hours — when people can reach you or collect meals." },
  { key: "photos", title: "Upload genuine photos", description: "Real photos of your meals, packaging and kitchen. No stock photos." },
  { key: "ordering_link", title: "Add an ordering link (where available)", description: "Point it to your plans page so customers can request an order." },
  { key: "reviews", title: "Ask real customers for reviews", description: "Share your review link with all customers after their order — not only happy ones. Never offer rewards for reviews or write your own." },
  { key: "holiday_hours", title: "Keep holiday hours up to date", description: "Update your hours for public holidays such as Christmas, Easter and Santa Marija." },
];

export const MONTHLY_ITEMS: ChecklistDefinition[] = [
  { key: "review_performance", title: "Review website performance", description: "Look at order requests, popular plans and campaigns in Growth & performance.", href: "/admin/growth" },
  { key: "search_terms", title: "Review popular search terms", description: "In Google Search Console, check which searches bring people to your site.", href: "/admin/listings" },
  { key: "improve_content", title: "Add or improve useful content", description: "Publish or update a blog article, or improve a service page.", href: "/admin/blog" },
  { key: "meal_photos", title: "Upload new real meal photos", description: "Fresh photos keep the menu and Instagram gallery current.", href: "/admin/meals" },
  { key: "listing_details", title: "Review business listing details", description: "Check your Google Business Profile and other listings match your website.", href: "/admin/listings" },
  { key: "reviews", title: "Respond to real customer reviews", description: "Reply politely to every review — positive or negative.", href: "/admin/listings" },
  { key: "promotions", title: "Review promotions", description: "Plan the next campaign and switch off ended ones.", href: "/admin/promotions" },
  { key: "delivery_areas", title: "Verify delivery area information", description: "Check localities, delivery days and fees are still correct.", href: "/admin/delivery" },
  { key: "email_delivery", title: "Check order emails arrive", description: "Send a test email from Business settings and make sure it isn't in spam.", href: "/admin/settings" },
];

/** "2026-11" in the business time zone. */
export function monthKey(date: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Only known checklist keys can be stored (prevents arbitrary writes). */
export function isValidChecklistKey(key: string): boolean {
  const [scope, ...rest] = key.split(".");
  if (scope === "launch") return rest.length === 1 && LAUNCH_MANUAL_ITEMS.some((i) => i.key === rest[0]);
  if (scope === "gbp") return rest.length === 1 && GBP_ITEMS.some((i) => i.key === rest[0]);
  if (scope === "monthly") {
    return rest.length === 2 && /^\d{4}-(0[1-9]|1[0-2])$/.test(rest[0]) && MONTHLY_ITEMS.some((i) => i.key === rest[1]);
  }
  return false;
}

export async function setChecklistItem(key: string, done: boolean, adminId: string | null) {
  if (!isValidChecklistKey(key)) throw new Error(`Unknown checklist item: ${key}`);
  return db.checklistItemState.upsert({
    where: { key },
    create: { key, done, doneAt: done ? new Date() : null, doneById: done ? adminId : null },
    update: { done, doneAt: done ? new Date() : null, doneById: done ? adminId : null },
  });
}

export async function getChecklistStates(prefix: string) {
  const rows = await db.checklistItemState.findMany({ where: { key: { startsWith: prefix } } });
  return new Map(rows.map((r) => [r.key, r]));
}

export async function getChecklist(scope: "gbp" | "launch" | `monthly.${string}`, items: ChecklistDefinition[]) {
  const states = await getChecklistStates(`${scope}.`);
  return items.map((item) => {
    const s = states.get(`${scope}.${item.key}`);
    return { ...item, fullKey: `${scope}.${item.key}`, done: Boolean(s?.done), doneAt: s?.doneAt ?? null };
  });
}

// ── Automatic launch readiness ──────────────────────────────────────────────

function isLocalHost(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || host.endsWith(".test");
  } catch {
    return true;
  }
}

/**
 * Launch readiness: automatic checks against real data + manual ticks.
 * Statuses: done, todo (must fix before launch) or warning (recommended).
 */
export async function getLaunchReadiness(now: Date = new Date()) {
  const settings = await getSettings();
  const e = env();
  const c = settings.contact;

  const [
    owner,
    testEmailSent,
    providerEmailSent,
    publishedMeals,
    mealsMissingPhoto,
    placeholderMealPhotos,
    activePlans,
    demoPlans,
    planNoPrice,
    availableAreas,
    orderCount,
    demoMeals,
    demoFaqs,
    demoGallery,
    placeholderGallery,
    demoPromos,
    legal,
    manual,
  ] = await Promise.all([
    db.adminUser.findFirst({ where: { role: "OWNER", isActive: true }, select: { id: true } }),
    db.emailOutbox.findFirst({ where: { type: "TEST", status: "SENT" }, select: { sentAt: true, provider: true } }),
    db.emailOutbox.findFirst({ where: { status: "SENT", provider: { not: "console" } }, select: { sentAt: true } }),
    db.meal.count({ where: { isPublished: true, archivedAt: null } }),
    db.meal.count({ where: { isPublished: true, archivedAt: null, imageId: null } }),
    db.meal.count({ where: { isPublished: true, archivedAt: null, image: { isPlaceholder: true } } }),
    db.plan.count({ where: { isActive: true, archivedAt: null } }),
    db.plan.count({ where: { isActive: true, archivedAt: null, isDemo: true } }),
    db.plan.count({ where: { isActive: true, archivedAt: null, priceCents: null } }),
    db.deliveryArea.count({ where: { isPublished: true, deliveryAvailable: true } }),
    db.order.count(),
    db.meal.count({ where: { isDemo: true, archivedAt: null } }),
    db.fAQ.count({ where: { isDemo: true } }),
    db.galleryItem.count({ where: { isDemo: true } }),
    db.galleryItem.count({ where: { mediaAsset: { isPlaceholder: true } } }),
    db.promotion.count({ where: { isDemo: true } }),
    Promise.all([getContent("legal.privacy"), getContent("legal.terms"), getContent("legal.cookies")]),
    getChecklist("launch", LAUNCH_MANUAL_ITEMS),
  ]);

  let sitemapOk = false;
  let sitemapDetail = "";
  try {
    const entries = await getSitemapEntries(now);
    sitemapOk = entries.length > 0;
    sitemapDetail = `${entries.length} pages listed`;
  } catch (error) {
    sitemapDetail = error instanceof Error ? error.message.slice(0, 120) : "Error";
  }

  const siteUrl = e.NEXT_PUBLIC_SITE_URL ?? "";
  const httpsDomain = siteUrl.startsWith("https://") && !isLocalHost(siteUrl);
  const vercelDomain = /\.vercel\.app$/i.test((() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return "";
    }
  })());
  const transport = emailTransport();
  const demoLeft = demoMeals + demoPlans + demoFaqs + demoGallery + demoPromos + placeholderGallery;
  const legalUnreviewed = legal.filter((l) => !l.reviewedByOwner).map((l) => l.title);

  const items: LaunchItem[] = [
    {
      key: "brand_name",
      title: "Business name configured",
      description: "Your trading name (and registered name, if different) appears in the footer, emails and Google.",
      status: settings.business.tradingName.trim() ? (settings.business.registeredName.trim() ? "done" : "warning") : "todo",
      detail: settings.business.registeredName.trim() ? undefined : "Add your registered company name for the footer and legal pages.",
      auto: true,
      href: "/admin/settings",
      hrefLabel: "Business settings",
    },
    {
      key: "logo",
      title: "Real logo uploaded",
      description: "Replace the temporary text logo with your MC monogram (PNG with a transparent background works best).",
      status: settings.branding.logoMediaId ? "done" : "todo",
      auto: true,
      href: "/admin/settings",
      hrefLabel: "Upload logo",
    },
    {
      key: "domain",
      title: "Domain and HTTPS configured",
      description: "The website address used in Google, emails and social previews.",
      status: httpsDomain ? (vercelDomain ? "warning" : "done") : "todo",
      detail: httpsDomain ? (vercelDomain ? `Using ${siteUrl} — connect your own domain.` : siteUrl) : `Currently ${siteUrl}. Ask your developer to set NEXT_PUBLIC_SITE_URL to your https:// domain.`,
      auto: true,
      href: "#developer-setup",
      hrefLabel: "Developer setup",
    },
    {
      key: "order_email",
      title: "Order notification email set",
      description: "The inbox that receives every new order request.",
      status: c.orderNotificationEmails.length > 0 ? "done" : "todo",
      detail: c.orderNotificationEmails.join(", ") || undefined,
      auto: true,
      href: "/admin/settings",
      hrefLabel: "Business settings",
    },
    {
      key: "email_provider",
      title: "Email provider connected",
      description: "Order emails are sent through a transactional email provider (Resend).",
      status: transport === "resend" ? "done" : "todo",
      detail: transport === "resend" ? undefined : transport === "console" ? "Development mode: emails are only written to the server log." : "No provider configured — emails are queued but not sent.",
      auto: true,
      href: "#developer-setup",
      hrefLabel: "Developer setup",
    },
    {
      key: "email_tested",
      title: "Transactional email tested",
      description: "Send a test email from Business settings and confirm it arrives (check spam too).",
      status: testEmailSent && testEmailSent.provider !== "console" ? "done" : providerEmailSent ? "done" : testEmailSent ? "warning" : "todo",
      detail: testEmailSent?.provider === "console" ? "The last test only went to the development log." : undefined,
      auto: true,
      href: "/admin/settings",
      hrefLabel: "Send test email",
    },
    {
      key: "whatsapp",
      title: "WhatsApp number configured",
      description: "Powers the floating WhatsApp button and order follow-ups.",
      status: normalizePhone(c.whatsappNumber) ? "done" : "todo",
      auto: true,
      href: "/admin/settings",
      hrefLabel: "Business settings",
    },
    {
      key: "instagram",
      title: "Instagram profile linked",
      description: "Used for the Follow on Instagram buttons and gallery links.",
      status: isInstagramUrl(c.instagramUrl) ? "done" : "todo",
      detail: c.instagramUrl || undefined,
      auto: true,
      href: "/admin/settings",
      hrefLabel: "Business settings",
    },
    {
      key: "meal_photos",
      title: "Real meal photos uploaded",
      description: "Every published meal should have a real photo of the meal.",
      status: publishedMeals === 0 ? "todo" : mealsMissingPhoto + placeholderMealPhotos === 0 ? "done" : "todo",
      detail: publishedMeals === 0 ? "No published meals yet." : mealsMissingPhoto ? `${mealsMissingPhoto} published meal(s) without a photo.` : undefined,
      auto: true,
      href: "/admin/meals",
      hrefLabel: "Meals",
    },
    {
      key: "prices",
      title: "Plan prices reviewed",
      description: "Set real prices for each plan. Sample plans are marked until you save them.",
      status: activePlans === 0 ? "todo" : demoPlans > 0 ? "todo" : planNoPrice > 0 ? "warning" : "done",
      detail:
        activePlans === 0
          ? "No active plans."
          : demoPlans > 0
            ? `${demoPlans} plan(s) still marked as samples.`
            : planNoPrice > 0
              ? `${planNoPrice} plan(s) show “price confirmed with you”.`
              : undefined,
      auto: true,
      href: "/admin/plans",
      hrefLabel: "Plans & prices",
    },
    {
      key: "delivery_areas",
      title: "Delivery areas confirmed",
      description: "Switch on only the localities you really deliver to, with days and any fees.",
      status: !settings.fulfillment.deliveryEnabled || availableAreas > 0 ? "done" : "todo",
      detail: settings.fulfillment.deliveryEnabled ? `${availableAreas} locality(ies) available for delivery.` : "Delivery is switched off (collection only).",
      auto: true,
      href: "/admin/delivery",
      hrefLabel: "Delivery & collection",
    },
    {
      key: "legal",
      title: "Privacy policy and terms reviewed",
      description: "The legal pages start as templates. Review them, replace the [placeholders] and tick “reviewed”.",
      status: legalUnreviewed.length === 0 ? "done" : "todo",
      detail: legalUnreviewed.length ? `Not yet reviewed: ${legalUnreviewed.join(", ")}.` : undefined,
      auto: true,
      href: "/admin/content",
      hrefLabel: "Homepage & pages",
    },
    {
      key: "demo_content",
      title: "Sample content replaced",
      description: "Sample FAQs, plans, gallery tiles and the example promotion should be reviewed or replaced.",
      status: demoLeft === 0 ? "done" : "todo",
      detail: demoLeft
        ? [
            demoMeals && `${demoMeals} meal(s)`,
            demoPlans && `${demoPlans} plan(s)`,
            demoFaqs && `${demoFaqs} FAQ(s)`,
            (demoGallery || placeholderGallery) && `${Math.max(demoGallery, placeholderGallery)} gallery item(s)`,
            demoPromos && `${demoPromos} promotion(s)`,
          ]
            .filter(Boolean)
            .join(", ") + " still marked as samples."
        : undefined,
      auto: true,
      href: "/admin/faqs",
      hrefLabel: "Review content",
    },
    {
      key: "demo_notice",
      title: "Preview banner switched off",
      description: "The “Preview site” banner at the top of every page should be turned off at launch.",
      status: settings.site.showDemoNotice ? "todo" : "done",
      auto: true,
      href: "/admin/settings",
      hrefLabel: "Business settings",
    },
    {
      key: "search_console",
      title: "Google Search Console verified",
      description: "Lets you see how people find you on Google and submit your sitemap.",
      status: settings.seo.googleSiteVerification.trim() || settings.seo.searchConsolePropertyUrl.trim() ? "done" : "todo",
      auto: true,
      href: "/admin/listings",
      hrefLabel: "Google & listings",
    },
    {
      key: "gbp",
      title: "Google Business Profile set up",
      description: "Your free listing on Google Search and Maps.",
      status: c.googleBusinessProfileUrl.trim() ? "done" : "todo",
      auto: true,
      href: "/admin/listings",
      hrefLabel: "Google & listings",
    },
    {
      key: "sitemap",
      title: "Sitemap working",
      description: "The list of pages Google uses to discover your site.",
      status: sitemapOk ? "done" : "todo",
      detail: sitemapDetail,
      auto: true,
      href: "/sitemap.xml",
      hrefLabel: "Open sitemap",
    },
    {
      key: "indexable",
      title: "Website visible to Google",
      description: "Production must allow search engines; preview sites are hidden automatically.",
      status: indexingAllowed() ? "done" : "todo",
      detail: indexingAllowed() ? undefined : "This deployment tells search engines not to index it (normal for previews and development).",
      auto: true,
      href: "/robots.txt",
      hrefLabel: "Open robots.txt",
    },
    {
      key: "admin_secured",
      title: "Admin login secured",
      description: "An owner account exists with a strong password and the session secret is set.",
      status: owner && e.AUTH_SECRET ? "done" : "todo",
      auto: true,
      href: "/admin/users",
      hrefLabel: "Admin users",
    },
    {
      key: "storage",
      title: "Production image storage",
      description: "Uploaded photos must be stored in cloud storage (S3-compatible) when hosting on Vercel.",
      status: e.STORAGE_DRIVER === "s3" ? "done" : e.VERCEL_ENV ? "todo" : "warning",
      detail: e.STORAGE_DRIVER === "s3" ? undefined : "Using local disk storage — fine for development or a single server.",
      auto: true,
      href: "#developer-setup",
      hrefLabel: "Developer setup",
    },
    {
      key: "test_order",
      title: "Test order submitted",
      description: "Submit an order request yourself and check the email arrives and the order appears in Orders.",
      status: orderCount > 0 ? "done" : "todo",
      auto: true,
      href: "/plans",
      hrefLabel: "Open plans page",
    },
    ...manual.map<LaunchItem>((m) => ({
      key: m.key,
      title: m.title,
      description: m.description,
      status: m.done ? "done" : "todo",
      auto: false,
      href: m.href ?? "/admin/launch",
      hrefLabel: m.href ? "Open" : "",
      doneAt: m.doneAt,
    })),
  ];

  const done = items.filter((i) => i.status === "done").length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}
