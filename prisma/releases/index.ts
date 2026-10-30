/**
 * Content releases: one-off, idempotent content changes that must reach
 * existing databases (production) as well as new ones. Each release runs
 * once and is recorded in SiteSetting "_releases", so later edits made in
 * the admin are never overwritten by a re-run.
 *
 *   npm run db:releases   (also part of `npm run db:seed` and the Vercel build)
 */
import { statSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { DISH_PHOTO_SIZE, INTRO_OFFER, LEGACY_PLAN_SLUGS, MENU, NUTRITION_SOURCE, PACKAGES } from "./menu-and-packages";

type Db = PrismaClient;

export interface Release {
  id: string;
  description: string;
  run(db: Db, log: (msg: string) => void): Promise<void>;
}

export const RELEASES_KEY = "_releases";

function fileSize(publicUrl: string): number {
  try {
    return statSync(path.join(process.cwd(), "public", publicUrl)).size;
  } catch {
    return 0;
  }
}

/** Media asset for a photo shipped with the site (served from /public). */
async function staticImage(db: Db, url: string, altText: string, category: "MEAL" | "GALLERY" | "BRANDING", width: number, height: number) {
  const storageKey = `static${url}`; // e.g. static/images/dishes/x.webp — never deleted from storage
  return db.mediaAsset.upsert({
    where: { storageKey },
    update: {},
    create: {
      storageKey,
      url,
      filename: url.split("/").pop() ?? url,
      mimeType: url.endsWith(".png") ? "image/png" : url.endsWith(".svg") ? "image/svg+xml" : "image/webp",
      sizeBytes: fileSize(url),
      width,
      height,
      altText,
      category,
    },
  });
}

export const RELEASES: Release[] = [
  {
    id: "2026-10-30-menu-and-packages",
    description: "Real menu (5 dishes with photos), package builder prices and the first-week €6 offer",
    async run(db, log) {
      // 1. Menu
      for (const [i, m] of MENU.entries()) {
        const image = await staticImage(db, m.image, m.imageAlt, "MEAL", DISH_PHOTO_SIZE, DISH_PHOTO_SIZE);
        const data = {
          name: m.name,
          shortDescription: m.shortDescription,
          description: m.description,
          calories: m.calories,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          nutritionSource: NUTRITION_SOURCE,
          nutritionVerified: true,
          label: m.label,
          imageId: image.id,
          isFeatured: true,
          isPublished: true,
          archivedAt: null,
          sortOrder: i,
          isDemo: false,
        };
        await db.meal.upsert({ where: { slug: m.slug }, update: data, create: { slug: m.slug, ...data } });
        log(`Menu: ${m.name}`);
      }

      // 2. Gallery: show the real photos instead of placeholder tiles.
      const gallery = await db.galleryItem.findMany({ select: { id: true, isDemo: true } });
      if (gallery.every((g) => g.isDemo)) {
        await db.galleryItem.updateMany({ where: { isDemo: true }, data: { isPublished: false } });
        for (const [i, m] of MENU.entries()) {
          const image = await staticImage(db, m.image, m.imageAlt, "MEAL", DISH_PHOTO_SIZE, DISH_PHOTO_SIZE);
          const exists = await db.galleryItem.findFirst({ where: { mediaAssetId: image.id } });
          if (exists) continue;
          await db.galleryItem.create({
            data: {
              mediaAssetId: image.id,
              caption: m.name,
              altText: m.imageAlt,
              instagramUrl: "https://www.instagram.com/mcpreps.mt/",
              isPublished: true,
              isFeatured: true,
              sortOrder: i,
            },
          });
        }
        log("Gallery: real meal photos");
      }

      // 3. Packages (create or update by slug) …
      for (const p of PACKAGES) {
        await db.plan.upsert({
          where: { slug: p.slug },
          update: { ...p, isActive: true, archivedAt: null, isDemo: false },
          create: { ...p, isActive: true, isDemo: false },
        });
        log(`Package: ${p.name}`);
      }
      // … only one recommended plan.
      await db.plan.updateMany({
        where: { isRecommended: true, slug: { notIn: PACKAGES.filter((p) => p.isRecommended).map((p) => p.slug) } },
        data: { isRecommended: false },
      });
      // … and retire the never-priced placeholder plans.
      const legacy = await db.plan.findMany({
        where: { slug: { in: LEGACY_PLAN_SLUGS }, priceCents: null, archivedAt: null },
        select: { id: true, name: true },
      });
      for (const l of legacy) {
        await db.plan.update({ where: { id: l.id }, data: { isActive: false, archivedAt: new Date(), isRecommended: false } });
        log(`Archived placeholder plan: ${l.name}`);
      }

      // 4. First-week offer (2-hour personal window).
      const now = new Date();
      const offer = {
        ...INTRO_OFFER,
        appliesToAllPlans: true,
        requiresCode: false,
        code: null,
        startsAt: new Date(now.getTime() - 60 * 60_000), // live straight away (allow for clock differences)
        endsAt: new Date(now.getTime() + 3 * 365 * 86_400_000),
        isEnabled: true,
        showCountdown: true,
        showOnHomepage: true,
        expiredBehavior: "HIDE" as const,
        isDemo: false,
      };
      const existing = await db.promotion.findUnique({ where: { slug: INTRO_OFFER.slug }, select: { id: true } });
      if (!existing) {
        await db.promotion.create({ data: offer });
        log(`Offer: ${INTRO_OFFER.name}`);
      }
    },
  },
  {
    id: "2026-10-30-enable-first-week-offer",
    description: "Switch the first-week €6 offer on (paused while the live site still ran code that couldn't read it)",
    async run(db, log) {
      const r = await db.promotion.updateMany({
        where: { slug: INTRO_OFFER.slug, discountType: "FIRST_WEEK_MEAL_PRICE", isEnabled: false },
        data: { isEnabled: true },
      });
      if (r.count > 0) log(`Offer switched on: ${INTRO_OFFER.name}`);
    },
  },
  {
    id: "2026-10-30-studio-dish-photos",
    description: "New studio photos of the five dishes",
    async run(db, log) {
      for (const m of MENU) {
        const old = await db.mediaAsset.findUnique({ where: { storageKey: `static${m.previousImage}` }, select: { id: true } });
        if (!old) continue; // database started after the photos changed: already has the new ones
        const fresh = await staticImage(db, m.image, m.imageAlt, "MEAL", DISH_PHOTO_SIZE, DISH_PHOTO_SIZE);
        // Only swap where the original shipped photo is still used; photos uploaded in the admin stay.
        const meals = await db.meal.updateMany({ where: { imageId: old.id }, data: { imageId: fresh.id } });
        const tiles = await db.galleryItem.updateMany({
          where: { mediaAssetId: old.id },
          data: { mediaAssetId: fresh.id, altText: m.imageAlt },
        });
        if (meals.count + tiles.count > 0) log(`New photo: ${m.name}`);
      }
    },
  },
];

/** Run releases that haven't run yet, in order. Returns the ids applied now. */
export async function applyReleases(db: Db, log: (msg: string) => void = console.log): Promise<string[]> {
  const row = await db.siteSetting.findUnique({ where: { key: RELEASES_KEY } });
  const done = new Set<string>(Array.isArray((row?.value as { applied?: unknown })?.applied) ? ((row!.value as { applied: string[] }).applied) : []);
  const applied: string[] = [];
  for (const release of RELEASES) {
    if (done.has(release.id)) continue;
    log(`▶ Content release ${release.id}: ${release.description}`);
    await release.run(db, (msg) => log(`  • ${msg}`));
    done.add(release.id);
    applied.push(release.id);
    const value = { applied: [...done], updatedAt: new Date().toISOString() };
    await db.siteSetting.upsert({ where: { key: RELEASES_KEY }, update: { value }, create: { key: RELEASES_KEY, value } });
  }
  if (applied.length === 0) log("Content releases: up to date");
  return applied;
}
