/**
 * Seed the database with brand-safe starter content.
 *
 *   npm run db:seed                 # default: no invented prices/areas/promotions
 *   SEED_PROFILE=demo npm run db:seed   # local preview: demo prices, live example promo,
 *                                       # three demo delivery localities (NEVER use in production)
 *
 * The seed is idempotent: existing records are left untouched so owner edits
 * are never overwritten.
 */
import "dotenv/config";
import sharp from "sharp";
import { db } from "@/lib/db";
import { createMediaAsset } from "@/lib/media";
import { hashPassword, passwordProblem } from "@/lib/passwords";
import { zonedLocalToUtc } from "@/lib/time";
import {
  BLOG_CATEGORIES,
  BLOG_DRAFTS,
  EXAMPLE_LOCALITIES,
  FAQS,
  GALLERY_WORDS,
  HALLOWEEN_PROMOTION,
  LISTINGS,
  MEAL_CHICKEN_POKEBOWL,
  PLANS,
} from "./seed-content";

const demo = process.env.SEED_PROFILE === "demo";
/** SEED_ONCE=1 (used by the Vercel build): seed starter content only on the first run. */
const once = process.env.SEED_ONCE === "1";
const SEED_MARKER_KEY = "_seed";
const log = (msg: string) => console.log(`  • ${msg}`);

if (demo && process.env.NODE_ENV === "production") {
  throw new Error("SEED_PROFILE=demo must never be used in production.");
}

/** Monochrome typographic placeholder tile (replace with real Instagram photos). */
async function placeholderTile(word: string, index: number): Promise<Buffer> {
  const variants = [
    { bg: "#080808", fg: "#ffffff" },
    { bg: "#171717", fg: "#f3f3f3" },
    { bg: "#f3f3f3", fg: "#080808" },
  ];
  const v = variants[index % variants.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${v.bg}"/>
  <g stroke="${v.fg}" stroke-opacity="0.08">${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90}" y2="1080"/><line x1="0" y1="${i * 90}" x2="1080" y2="${i * 90}"/>`).join("")}</g>
  <text x="60" y="1010" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="230" letter-spacing="-10" fill="${v.fg}">${word.toUpperCase()}</text>
  <text x="64" y="120" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="34" letter-spacing="10" fill="${v.fg}" fill-opacity="0.7">MC PREPS</text>
  <circle cx="960" cy="110" r="22" fill="${v.fg}" fill-opacity="0.85"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function seedPlans() {
  for (const plan of PLANS) {
    const existing = await db.plan.findUnique({ where: { slug: plan.slug } });
    if (existing) {
      if (demo && existing.priceCents === null && existing.isDemo) {
        await db.plan.update({ where: { id: existing.id }, data: { priceCents: plan.demoPriceCents } });
        log(`Plan "${plan.name}": demo price set`);
      }
      continue;
    }
    await db.plan.create({
      data: {
        slug: plan.slug,
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        durationDays: plan.durationDays,
        mealsIncluded: null, // confirm with the business
        features: plan.features,
        priceCents: demo ? plan.demoPriceCents : null, // never invent real prices
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
        isDemo: true,
      },
    });
    log(`Plan "${plan.name}" (${demo ? "demo price" : "price on request — set it in the admin"})`);
  }
}

async function seedMeals() {
  const m = MEAL_CHICKEN_POKEBOWL;
  if (await db.meal.findUnique({ where: { slug: m.slug } })) return;
  await db.meal.create({
    data: {
      ...m,
      dietaryTags: [],
      allergens: [],
      isPublished: true,
      sortOrder: 0,
      isDemo: false,
    },
  });
  log(`Meal "${m.name}" (nutrition from Instagram screenshot — verify)`);
}

async function seedFaqs() {
  if ((await db.fAQ.count()) > 0) return;
  await db.fAQ.createMany({
    data: FAQS.map((f, i) => ({ ...f, sortOrder: i, isPublished: true, showOnHomepage: true, isDemo: true })),
  });
  log(`${FAQS.length} FAQs (review wording)`);
}

async function seedGallery() {
  if ((await db.galleryItem.count()) > 0) return;
  // Placeholder tiles need persistent storage; local disk on Vercel isn't kept.
  if (process.env.VERCEL && (process.env.STORAGE_DRIVER ?? "local") === "local") {
    log("Gallery placeholders skipped (configure S3/R2 storage, then upload real photos)");
    return;
  }
  for (const [i, word] of GALLERY_WORDS.entries()) {
    const buffer = await placeholderTile(word, i);
    const asset = await createMediaAsset({
      file: { name: `placeholder-${word.toLowerCase()}.png`, buffer },
      category: "GALLERY",
      altText: `MC PREPS placeholder tile — ${word}`,
      isPlaceholder: true,
    });
    await db.galleryItem.create({
      data: {
        mediaAssetId: asset.id,
        caption: null,
        altText: `MC PREPS — ${word}`,
        instagramUrl: "https://www.instagram.com/mcpreps.mt/",
        isPublished: true,
        isFeatured: true,
        sortOrder: i,
        isDemo: true,
      },
    });
  }
  log(`${GALLERY_WORDS.length} placeholder gallery tiles (replace with Instagram photos)`);
}

/** Next 31 October 23:59 Malta time (or 72 hours from now in the demo profile). */
function halloweenWindow(now: Date) {
  if (demo) return { startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 72 * 3_600_000) };
  let year = now.getUTCFullYear();
  let end = zonedLocalToUtc(`${year}-10-31T23:59`, "Europe/Malta")!;
  if (end.getTime() < now.getTime()) {
    year += 1;
    end = zonedLocalToUtc(`${year}-10-31T23:59`, "Europe/Malta")!;
  }
  return { startsAt: new Date(end.getTime() - 72 * 3_600_000 + 60_000), endsAt: end };
}

async function seedPromotion() {
  const p = HALLOWEEN_PROMOTION;
  const existing = await db.promotion.findUnique({ where: { slug: p.slug } });
  const now = new Date();
  const window = halloweenWindow(now);
  let promotionId = existing?.id;
  if (!existing) {
    const created = await db.promotion.create({
      data: {
        ...p,
        ...window,
        isEnabled: demo, // EXAMPLE: owner sets discount + deadline, then enables it
        showCountdown: true,
        showOnHomepage: true,
        appliesToAllPlans: true,
        requiresCode: false,
        isDemo: true,
        expiredBehavior: "HIDE",
      },
    });
    promotionId = created.id;
    log(`Promotion "${p.name}" (${demo ? "LIVE demo, ends in 72h" : "draft — confirm discount & deadline, then enable"})`);
  } else if (demo && existing.isDemo) {
    await db.promotion.update({ where: { id: existing.id }, data: { ...window, isEnabled: true } });
    log(`Promotion "${p.name}" re-armed for demo (72h)`);
  }

  const landingSlug = "halloween";
  if (promotionId && !(await db.seasonalCampaignLandingPage.findUnique({ where: { slug: landingSlug } }))) {
    await db.seasonalCampaignLandingPage.create({
      data: {
        slug: landingSlug,
        type: "SEASONAL",
        title: "Halloween Special",
        headline: "Halloween fuel deal",
        subheadline: "Your first plan. Your special price.",
        body: "<p>New to MC PREPS? Request your first meal plan before the countdown ends to claim our Halloween offer. Our team verifies first-order eligibility and confirms your final price with you — no payment is taken online.</p>",
        ctaText: "Claim your first-order offer",
        promotionId,
        utmCampaign: "halloween",
        isPublished: demo,
        noindex: true,
        expiredBehavior: "SHOW_EXPIRED_MESSAGE",
        expiredMessage: "Our Halloween offer has ended. Follow us on Instagram to hear about the next one.",
      },
    });
    log(`Offer page /offers/${landingSlug} (${demo ? "published" : "draft"})`);
  }
}

async function seedDeliveryAreas() {
  if ((await db.deliveryArea.count()) > 0) return;
  await db.deliveryArea.createMany({
    data: EXAMPLE_LOCALITIES.map(([name, slug], i) => ({
      name,
      slug,
      region: "MALTA" as const,
      deliveryAvailable: demo && i < 3,
      isPublished: demo && i < 3,
      deliveryDays: [],
      notes: demo && i < 3 ? "Demo locality — not confirmed by the business." : null,
      sortOrder: i,
    })),
  });
  log(`${EXAMPLE_LOCALITIES.length} example localities (${demo ? "3 enabled for demo" : "all unconfirmed — enable the ones you serve"})`);
}

async function seedListings() {
  if ((await db.businessListing.count()) > 0) return;
  await db.businessListing.createMany({ data: LISTINGS.map((l) => ({ ...l, status: "NOT_STARTED" as const })) });
  log("Business listing tracker (Google, Apple, Bing)");
}

async function seedBlog() {
  for (const [i, c] of BLOG_CATEGORIES.entries()) {
    await db.blogCategory.upsert({ where: { slug: c.slug }, create: { ...c, sortOrder: i }, update: {} });
  }
  const categories = new Map((await db.blogCategory.findMany()).map((c) => [c.slug, c.id]));
  let created = 0;
  for (const post of BLOG_DRAFTS) {
    if (await db.blogPost.findUnique({ where: { slug: post.slug } })) continue;
    await db.blogPost.create({
      data: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        contentHtml: post.html,
        categoryId: categories.get(post.category) ?? null,
        primaryTopic: post.primaryTopic,
        authorName: "MC PREPS",
        status: "DRAFT",
        needsReview: true,
      },
    });
    created++;
  }
  if (created) log(`${created} blog article drafts (review before publishing)`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;
  const problem = passwordProblem(password);
  if (problem) throw new Error(`SEED_ADMIN_PASSWORD: ${problem}`);
  if (await db.adminUser.findUnique({ where: { email } })) return;
  await db.adminUser.create({
    data: {
      email,
      name: process.env.SEED_ADMIN_NAME?.trim() || "Owner",
      passwordHash: await hashPassword(password),
      role: "OWNER",
    },
  });
  log(`Owner account ${email}`);
}

async function main() {
  console.log(`Seeding MC PREPS (${demo ? "DEMO profile" : "brand-safe profile"})…`);
  if (once && (await db.siteSetting.findUnique({ where: { key: SEED_MARKER_KEY } }))) {
    // Starter content was already added once; never re-create content the owner removed.
    await seedAdmin();
    console.log("Starter content already seeded — skipped.");
    return;
  }
  await seedPlans();
  await seedMeals();
  await seedFaqs();
  await seedGallery();
  await seedPromotion();
  await seedDeliveryAreas();
  await seedListings();
  await seedBlog();
  await seedAdmin();
  await db.siteSetting.upsert({
    where: { key: SEED_MARKER_KEY },
    create: { key: SEED_MARKER_KEY, value: { seededAt: new Date().toISOString(), profile: demo ? "demo" : "brand-safe" } },
    update: {},
  });
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
