import "server-only";
import { db } from "@/lib/db";
import { getContent, type ContentKey } from "@/lib/content";
import { checkRedirect } from "@/lib/redirect-rules";
import { extractInternalLinks } from "@/lib/sanitize";
import { getSettings } from "@/lib/settings";
import { getPageSeo } from "@/lib/seo/metadata";
import {
  DESCRIPTION_RECOMMENDED_MAX,
  DESCRIPTION_RECOMMENDED_MIN,
  STATIC_PAGES,
  TITLE_RECOMMENDED_MAX,
  type StaticPageKey,
} from "@/lib/seo/pages";
import { canonicalIsSelf, getActiveRedirectSources, getKnownPublicPaths, isResolvablePath } from "@/lib/seo/sitemap";
import { normalizePath } from "@/lib/urls";
import { blogVisibility, countWords, THIN_CONTENT_WORDS } from "@/lib/admin/blog-utils";

export type IssueSeverity = "error" | "warning" | "info";

export interface SeoIssue {
  /** Stable id (code + subject) */
  id: string;
  code: string;
  severity: IssueSeverity;
  title: string;
  message: string;
  /** Where to fix it in the admin */
  href: string;
  /** Public page the issue relates to, if any */
  path?: string;
}

export type SeoPageKind = "page" | "blog" | "meal" | "offer" | "locality";

export interface SeoPageRow {
  kind: SeoPageKind;
  id: string;
  label: string;
  path: string;
  title: string;
  description: string;
  indexable: boolean;
  /** Visible to visitors (published) */
  live: boolean;
  status: string;
  group: string;
  editHref: string;
  seoHref: string;
  issueCount: number;
}

export const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  error: "Fix now",
  warning: "Should fix",
  info: "Good to know",
};

const LARGE_IMAGE_BYTES = 1_500_000;
const LARGE_IMAGE_WIDTH = 3000;
const IMPORTANT_GROUPS = new Set(["core", "service"]);

function headingOf(content: Record<string, unknown>): string | null {
  for (const field of ["headline", "h1", "heading", "title"]) {
    const v = content[field];
    if (typeof v === "string") return v;
  }
  return null;
}

function issue(code: string, subject: string, severity: IssueSeverity, title: string, message: string, href: string, path?: string): SeoIssue {
  return { id: `${code}:${subject}`, code, severity, title, message, href, path };
}

function sortIssues(issues: SeoIssue[]) {
  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title));
}

/**
 * Full SEO overview: every public page with its effective Google title and
 * description, plus plain-language issues with links to fix them.
 */
export async function getSeoOverview(now: Date = new Date()): Promise<{ pages: SeoPageRow[]; issues: SeoIssue[] }> {
  const settings = await getSettings();
  const suffix = settings.seo.titleSuffix || settings.business.tradingName;
  const issues: SeoIssue[] = [];
  const pages: SeoPageRow[] = [];

  const [known, redirectSources, meals, posts, landings, areas, gallery, promotions, redirects, largeMedia] = await Promise.all([
    getKnownPublicPaths(now),
    getActiveRedirectSources(),
    db.meal.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        isPublished: true,
        seoTitle: true,
        seoDescription: true,
        shortDescription: true,
        image: { select: { id: true, altText: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.blogPost.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishAt: true,
        excerpt: true,
        seoTitle: true,
        seoDescription: true,
        contentHtml: true,
        coverAlt: true,
        coverImage: { select: { altText: true } },
        noindex: true,
        canonicalUrl: true,
        needsReview: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.seasonalCampaignLandingPage.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        isPublished: true,
        noindex: true,
        seoTitle: true,
        seoDescription: true,
        subheadline: true,
        body: true,
        heroImage: { select: { altText: true } },
        promotion: { select: { name: true, isEnabled: true, startsAt: true, endsAt: true } },
      },
    }),
    db.deliveryArea.findMany({
      where: { isPublished: true },
      select: { id: true, name: true, slug: true, hasPublicPage: true, pageIntro: true, pageBody: true, deliveryAvailable: true },
    }),
    db.galleryItem.findMany({
      where: { isPublished: true },
      select: { id: true, altText: true, mediaAsset: { select: { altText: true } } },
    }),
    db.promotion.findMany({
      where: { isEnabled: true, endsAt: { gt: now } },
      select: { id: true, name: true, image: { select: { altText: true } } },
    }),
    db.redirectRule.findMany({ select: { id: true, fromPath: true, toPath: true, isActive: true } }),
    db.mediaAsset.findMany({
      where: { OR: [{ sizeBytes: { gt: LARGE_IMAGE_BYTES } }, { width: { gt: LARGE_IMAGE_WIDTH } }] },
      select: { id: true, filename: true, sizeBytes: true, width: true },
      take: 50,
    }),
  ]);

  const resolvable = (href: string) => isResolvablePath(href, known, redirectSources);

  // ── Fixed pages ───────────────────────────────────────────────────────────
  for (const def of STATIC_PAGES) {
    const seo = await getPageSeo(def.key as StaticPageKey);
    const indexable = !seo.noindex;
    const editHref = `/admin/seo/${def.key}`;
    pages.push({
      kind: "page",
      id: def.key,
      label: def.label,
      path: def.path,
      title: seo.title,
      description: seo.description,
      indexable,
      live: true,
      status: "Live",
      group: def.group,
      editHref: "contentKey" in def ? "/admin/content" : editHref,
      seoHref: editHref,
      issueCount: 0,
    });

    if (!seo.description.trim()) {
      issues.push(
        issue(
          "MISSING_DESCRIPTION",
          def.path,
          "warning",
          `${def.label}: no SEO description`,
          `Your ${def.label} page has no SEO description. Add a short description to help people understand your service in Google.`,
          editHref,
          def.path,
        ),
      );
    }
    if (def.indexable && seo.noindex && IMPORTANT_GROUPS.has(def.group)) {
      issues.push(
        issue(
          "NOINDEX_IMPORTANT",
          def.path,
          "error",
          `${def.label} is hidden from Google`,
          `The ${def.label} page is set to “don't show in Google”. Unless this is intentional, turn indexing back on so people can find it.`,
          editHref,
          def.path,
        ),
      );
    }
    if (seo.canonical) {
      const self = canonicalIsSelf(seo.canonical, def.path);
      if (!self) {
        const target = /^https?:\/\//i.test(seo.canonical) ? null : seo.canonical;
        if (target && !resolvable(target)) {
          issues.push(
            issue(
              "CANONICAL_BROKEN",
              def.path,
              "error",
              `${def.label}: canonical address doesn't exist`,
              `The ${def.label} page tells Google its main version is ${seo.canonical}, but that page doesn't exist. Clear the canonical URL or fix it.`,
              editHref,
              def.path,
            ),
          );
        } else {
          issues.push(
            issue(
              "CANONICAL_ELSEWHERE",
              def.path,
              "warning",
              `${def.label} points Google to another page`,
              `The ${def.label} page has a canonical URL (${seo.canonical}) pointing somewhere else, so Google may not show this page. Only use this if the page is a duplicate.`,
              editHref,
              def.path,
            ),
          );
        }
        if (seo.noindex) {
          issues.push(
            issue(
              "CANONICAL_NOINDEX_CONFLICT",
              def.path,
              "warning",
              `${def.label}: conflicting signals`,
              `The ${def.label} page is both hidden from Google and points to another page as its main version. Use one or the other.`,
              editHref,
              def.path,
            ),
          );
        }
      }
    }
    if ("contentKey" in def && def.contentKey) {
      const content = (await getContent(def.contentKey as ContentKey)) as unknown as Record<string, unknown>;
      const heading = headingOf(content);
      if (heading !== null && !heading.trim()) {
        issues.push(
          issue(
            "MISSING_HEADING",
            def.path,
            "warning",
            `${def.label}: no main heading`,
            `The ${def.label} page has no main heading. Add one in Homepage & pages so visitors and Google know what the page is about.`,
            "/admin/content",
            def.path,
          ),
        );
      }
    }
  }

  // ── Blog posts ────────────────────────────────────────────────────────────
  let draftsToReview = 0;
  for (const post of posts) {
    const path = `/blog/${post.slug}`;
    const visibility = blogVisibility(post, now);
    const live = visibility === "PUBLISHED";
    const editHref = `/admin/blog/${post.id}`;
    const title = post.seoTitle?.trim() || `${post.title} | ${suffix}`;
    const description = post.seoDescription?.trim() || post.excerpt?.trim() || "";
    pages.push({
      kind: "blog",
      id: post.id,
      label: post.title,
      path,
      title,
      description,
      indexable: live && !post.noindex && canonicalIsSelf(post.canonicalUrl, path),
      live,
      status: visibility === "PUBLISHED" ? "Published" : visibility === "SCHEDULED" ? "Scheduled" : "Draft",
      group: "blog",
      editHref,
      seoHref: editHref,
      issueCount: 0,
    });

    if (visibility === "DRAFT" && post.needsReview) draftsToReview++;
    if (live && post.needsReview) {
      issues.push(
        issue("PUBLISHED_NEEDS_REVIEW", path, "warning", `“${post.title}” is live but marked for fact-checking`, `Check the facts in “${post.title}”, then untick “Needs fact-check”.`, editHref, path),
      );
    }
    if (!live) {
      // Broken links in drafts matter too, but at a lower level.
      for (const link of extractInternalLinks(post.contentHtml)) {
        if (!resolvable(link)) {
          issues.push(
            issue("BROKEN_LINK", `${path}:${link}`, "info", `Draft “${post.title}” links to a missing page`, `The draft links to ${link}, which doesn't exist. Fix the link before publishing.`, editHref, path),
          );
        }
      }
      continue;
    }
    if (!description) {
      issues.push(
        issue("MISSING_DESCRIPTION", path, "warning", `“${post.title}”: no SEO description`, `The article “${post.title}” has no SEO description or excerpt. Add one so Google can show a helpful summary.`, editHref, path),
      );
    }
    const words = countWords(post.contentHtml);
    if (words < THIN_CONTENT_WORDS) {
      issues.push(
        issue(
          "THIN_CONTENT",
          path,
          "warning",
          `“${post.title}” is very short`,
          `“${post.title}” has only ${words} words. Articles with fewer than ${THIN_CONTENT_WORDS} words rarely help in Google — add more useful detail.`,
          editHref,
          path,
        ),
      );
    }
    for (const link of extractInternalLinks(post.contentHtml)) {
      if (!resolvable(link)) {
        issues.push(
          issue(
            "BROKEN_LINK",
            `${path}:${link}`,
            "error",
            `Broken link in “${post.title}”`,
            `The article “${post.title}” links to ${link}, which doesn't exist. Update or remove the link, or add a redirect.`,
            editHref,
            path,
          ),
        );
      }
    }
    if (post.noindex) {
      issues.push(issue("NOINDEX_POST", path, "info", `“${post.title}” is hidden from Google`, `This published article is set to “don't show in Google”.`, editHref, path));
    }
    if (post.canonicalUrl && !canonicalIsSelf(post.canonicalUrl, path)) {
      issues.push(
        issue("CANONICAL_ELSEWHERE", path, "info", `“${post.title}” points Google elsewhere`, `This article's canonical URL is ${post.canonicalUrl}, so Google will treat that page as the main version.`, editHref, path),
      );
    }
    const coverAlt = post.coverAlt?.trim() || post.coverImage?.altText?.trim();
    if (post.coverImage && !coverAlt) {
      issues.push(
        issue("MISSING_ALT", `blog-cover:${post.id}`, "warning", `Cover photo of “${post.title}” has no description`, `Add alt text to the cover photo of “${post.title}” so visually impaired visitors and Google understand it.`, editHref, path),
      );
    }
  }
  if (draftsToReview > 0) {
    issues.push(
      issue(
        "DRAFTS_TO_REVIEW",
        "blog",
        "info",
        `${draftsToReview} blog draft${draftsToReview === 1 ? "" : "s"} waiting for review`,
        `${draftsToReview} draft article${draftsToReview === 1 ? " is" : "s are"} waiting to be fact-checked and published. Useful articles help people find you on Google.`,
        "/admin/blog?status=review",
      ),
    );
  }

  // ── Meals ─────────────────────────────────────────────────────────────────
  for (const meal of meals) {
    const path = `/menu/${meal.slug}`;
    const editHref = `/admin/meals/${meal.id}`;
    const description = meal.seoDescription?.trim() || meal.shortDescription?.trim() || "";
    pages.push({
      kind: "meal",
      id: meal.id,
      label: meal.name,
      path,
      title: meal.seoTitle?.trim() || `${meal.name} | ${suffix}`,
      description,
      indexable: meal.isPublished,
      live: meal.isPublished,
      status: meal.isPublished ? "Published" : "Hidden",
      group: "meal",
      editHref,
      seoHref: editHref,
      issueCount: 0,
    });
    if (!meal.isPublished) continue;
    if (!description) {
      issues.push(
        issue("MISSING_DESCRIPTION", path, "warning", `${meal.name}: no description`, `The ${meal.name} page has no short description. Add one so the meal looks good in Google and on the menu.`, editHref, path),
      );
    }
    if (meal.image && !meal.image.altText?.trim()) {
      issues.push(
        issue("MISSING_ALT", `meal:${meal.id}`, "warning", `${meal.name} photo has no description`, `Add alt text to the ${meal.name} photo (for example “Chicken Pokébowl with rice and greens”).`, `/admin/media`, path),
      );
    }
  }

  // ── Offer (landing) pages ─────────────────────────────────────────────────
  for (const page of landings) {
    const path = `/offers/${page.slug}`;
    const editHref = `/admin/landing-pages/${page.id}`;
    const description = page.seoDescription?.trim() || page.subheadline?.trim() || "";
    const promoLive = Boolean(page.promotion && page.promotion.isEnabled && page.promotion.startsAt <= now && page.promotion.endsAt > now);
    pages.push({
      kind: "offer",
      id: page.id,
      label: page.title,
      path,
      title: page.seoTitle?.trim() || `${page.title} | ${suffix}`,
      description,
      indexable: page.isPublished && !page.noindex,
      live: page.isPublished,
      status: page.isPublished ? "Published" : "Draft",
      group: "offer",
      editHref,
      seoHref: editHref,
      issueCount: 0,
    });
    if (!page.isPublished) {
      if (promoLive) {
        issues.push(
          issue(
            "UNPUBLISHED_OFFER_PAGE",
            path,
            "info",
            `Offer page “${page.title}” isn't published`,
            `The ${page.promotion!.name} promotion is live, but its offer page ${path} is still a draft. Publish it if you plan to link to it from ads or social posts.`,
            editHref,
            path,
          ),
        );
      }
      continue;
    }
    for (const link of extractInternalLinks(page.body ?? "")) {
      if (!resolvable(link)) {
        issues.push(
          issue("BROKEN_LINK", `${path}:${link}`, "error", `Broken link on offer page “${page.title}”`, `The offer page links to ${link}, which doesn't exist. Update the link or add a redirect.`, editHref, path),
        );
      }
    }
    if (page.heroImage && !page.heroImage.altText?.trim()) {
      issues.push(issue("MISSING_ALT", `landing:${page.id}`, "warning", `Offer page “${page.title}”: photo has no description`, `Add alt text to the main photo of the offer page.`, "/admin/media", path));
    }
  }

  // ── Delivery locality pages ───────────────────────────────────────────────
  for (const area of areas) {
    if (!area.hasPublicPage) continue;
    const path = `/delivery-areas/${area.slug}`;
    const hasText = Boolean(area.pageIntro?.trim() || area.pageBody?.trim());
    pages.push({
      kind: "locality",
      id: area.id,
      label: `Delivery — ${area.name}`,
      path,
      title: `Meal Prep Delivery in ${area.name} | ${suffix}`,
      description: area.pageIntro?.trim() ?? "",
      indexable: hasText,
      live: hasText,
      status: hasText ? "Published" : "No content",
      group: "locality",
      editHref: "/admin/delivery",
      seoHref: "/admin/delivery",
      issueCount: 0,
    });
    if (!hasText) {
      issues.push(
        issue(
          "LOCALITY_PAGE_EMPTY",
          path,
          "warning",
          `${area.name} page has no content`,
          `${area.name} is set to have its own page, but it has no text, so the page isn't shown. Add unique local details (delivery days, collection options) or switch the page off.`,
          "/admin/delivery",
          path,
        ),
      );
    }
  }

  // ── Duplicate titles (live, indexable pages only) ─────────────────────────
  const byTitle = new Map<string, SeoPageRow[]>();
  for (const p of pages) {
    if (!p.live || !p.indexable) continue;
    const key = p.title.trim().toLowerCase();
    if (!key) continue;
    byTitle.set(key, [...(byTitle.get(key) ?? []), p]);
  }
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const names = group.map((g) => `“${g.label}”`).join(" and ");
    for (const p of group) {
      issues.push(
        issue(
          "DUPLICATE_TITLE",
          p.path,
          "warning",
          `Duplicate Google title: ${p.label}`,
          `${names} use the same Google title. Give each page its own title so Google can tell them apart.`,
          p.seoHref,
          p.path,
        ),
      );
    }
  }

  // ── Title / description length hints ──────────────────────────────────────
  for (const p of pages) {
    if (!p.live || !p.indexable) continue;
    if (p.title.length > TITLE_RECOMMENDED_MAX + 10) {
      issues.push(
        issue(
          "TITLE_LONG",
          p.path,
          "info",
          `${p.label}: long Google title`,
          `The Google title is ${p.title.length} characters. Google usually shows about ${TITLE_RECOMMENDED_MAX}, so the end may be cut off.`,
          p.seoHref,
          p.path,
        ),
      );
    }
    if (p.description && p.description.length > DESCRIPTION_RECOMMENDED_MAX + 20) {
      issues.push(
        issue("DESCRIPTION_LONG", p.path, "info", `${p.label}: long description`, `The description is ${p.description.length} characters. Google usually shows up to about ${DESCRIPTION_RECOMMENDED_MAX}.`, p.seoHref, p.path),
      );
    } else if (p.description && p.description.length < DESCRIPTION_RECOMMENDED_MIN - 20) {
      issues.push(
        issue("DESCRIPTION_SHORT", p.path, "info", `${p.label}: short description`, `The description is only ${p.description.length} characters. A sentence or two (about ${DESCRIPTION_RECOMMENDED_MIN}–${DESCRIPTION_RECOMMENDED_MAX} characters) works best.`, p.seoHref, p.path),
      );
    }
  }

  // ── Images ────────────────────────────────────────────────────────────────
  const galleryMissingAlt = gallery.filter((g) => !g.altText?.trim() && !g.mediaAsset.altText?.trim()).length;
  if (galleryMissingAlt > 0) {
    issues.push(
      issue(
        "MISSING_ALT",
        "gallery",
        "warning",
        `${galleryMissingAlt} gallery photo${galleryMissingAlt === 1 ? "" : "s"} without a description`,
        `Add alt text to your Instagram gallery photos so visually impaired visitors and Google understand them.`,
        "/admin/gallery",
      ),
    );
  }
  for (const promo of promotions) {
    if (promo.image && !promo.image.altText?.trim()) {
      issues.push(issue("MISSING_ALT", `promotion:${promo.id}`, "info", `${promo.name}: banner photo has no description`, `Add alt text to the promotion's background photo.`, "/admin/media"));
    }
  }
  const [hero, finalCta] = await Promise.all([getContent("home.hero"), getContent("home.finalCta")]);
  if (hero.imageId && !hero.imageAlt.trim()) {
    issues.push(issue("MISSING_ALT", "home-hero", "warning", "Homepage hero photo has no description", "Add a short description of the homepage hero photo in Homepage & pages.", "/admin/content", "/"));
  }
  if (finalCta.imageId) {
    const media = await db.mediaAsset.findUnique({ where: { id: finalCta.imageId }, select: { altText: true } });
    if (media && !media.altText?.trim()) {
      issues.push(issue("MISSING_ALT", "home-final-cta", "info", "Homepage closing photo has no description", "Add alt text to this photo in the Media library.", "/admin/media", "/"));
    }
  }
  for (const m of largeMedia) {
    issues.push(
      issue(
        "OVERSIZED_IMAGE",
        `media:${m.id}`,
        "warning",
        `Large image: ${m.filename}`,
        `${m.filename} is ${(m.sizeBytes / 1_000_000).toFixed(1)} MB${m.width ? ` and ${m.width}px wide` : ""}. Large images slow the site on mobile — replace it with a smaller version.`,
        "/admin/media",
      ),
    );
  }

  // ── Links inside editable page content ────────────────────────────────────
  const ctaChecks: { label: string; href: string | undefined }[] = [
    { label: "Homepage hero main button", href: hero.primaryCta.href },
    { label: "Homepage hero second button", href: hero.secondaryCta.href },
    { label: "Homepage closing button", href: finalCta.cta.href },
    { label: "Announcement bar link", href: settings.site.announcementHref || undefined },
  ];
  for (const key of ["service.mealPrepMalta", "service.healthyMealDeliveryMalta", "service.mealPlansMalta", "service.highProteinMealsMalta"] as const) {
    const c = await getContent(key);
    ctaChecks.push({ label: `${c.eyebrow} page button`, href: c.cta.href });
  }
  for (const cta of ctaChecks) {
    if (!cta.href || !cta.href.startsWith("/") || cta.href.startsWith("//")) continue;
    const path = cta.href.split(/[?#]/)[0] || "/";
    if (!resolvable(path)) {
      issues.push(
        issue("BROKEN_LINK", `content:${cta.label}`, "error", `Broken button link: ${cta.label}`, `The “${cta.label}” points to ${cta.href}, which doesn't exist. Update it in Homepage & pages.`, cta.label.startsWith("Announcement") ? "/admin/settings" : "/admin/content"),
      );
    }
  }

  // ── Redirects ─────────────────────────────────────────────────────────────
  for (const r of redirects) {
    if (!r.isActive) continue;
    const others = redirects.filter((o) => o.id !== r.id);
    const problem = checkRedirect({ fromPath: r.fromPath, toPath: r.toPath }, others);
    const href = `/admin/redirects/${r.id}`;
    if (problem === "LOOP") {
      issues.push(issue("REDIRECT_LOOP", r.id, "error", `Redirect loop: ${r.fromPath}`, `${r.fromPath} → ${r.toPath} creates a loop, so visitors never reach a page. Change or remove one of the redirects.`, href));
    } else if (problem === "CHAIN") {
      issues.push(issue("REDIRECT_CHAIN", r.id, "warning", `Redirect chain: ${r.fromPath}`, `${r.fromPath} redirects to ${r.toPath}, which redirects again. Point it straight at the final page.`, href));
    } else if (problem) {
      issues.push(issue("REDIRECT_INVALID", r.id, "error", `Invalid redirect: ${r.fromPath}`, `The redirect ${r.fromPath} → ${r.toPath} isn't valid. Edit or delete it.`, href));
    }
    if (!/^https?:\/\//i.test(r.toPath) && problem !== "LOOP") {
      const target = normalizePath(r.toPath);
      if (!known.has(target) && !redirectSources.has(target)) {
        issues.push(
          issue("REDIRECT_TARGET_MISSING", r.id, "error", `Redirect goes to a missing page: ${r.fromPath}`, `${r.fromPath} redirects to ${r.toPath}, but that page doesn't exist. Visitors will see “page not found”.`, href),
        );
      }
    }
    if (known.has(normalizePath(r.fromPath))) {
      issues.push(
        issue("REDIRECT_SHADOWS_PAGE", r.id, "info", `Redirect hides an existing page: ${r.fromPath}`, `${r.fromPath} is a real page on your site, but the redirect sends visitors to ${r.toPath} instead.`, href),
      );
    }
  }

  // ── Structured data inputs (LocalBusiness) ────────────────────────────────
  const c = settings.contact;
  if (!c.phone.trim()) {
    issues.push(issue("SCHEMA_PHONE", "business", "warning", "No business phone number", "Google can't show a phone number for your business because none is set. Add it in Business settings.", "/admin/settings"));
  }
  if (!c.publicEmail.trim()) {
    issues.push(issue("SCHEMA_EMAIL", "business", "info", "No public email address", "Add a public contact email in Business settings so customers and Google have a way to reach you.", "/admin/settings"));
  }
  if (!settings.branding.logoMediaId) {
    issues.push(issue("SCHEMA_LOGO", "business", "warning", "No logo uploaded", "Upload your MC PREPS logo in Business settings. Google uses it next to your business information.", "/admin/settings"));
  }
  const servedAreas = areas.filter((a) => a.deliveryAvailable).length;
  if (servedAreas === 0 && !settings.business.areaServedText.trim()) {
    issues.push(issue("SCHEMA_AREA", "business", "warning", "No service area", "Tell Google where you operate: confirm your delivery localities or set the area served in Business settings.", "/admin/delivery"));
  }

  // ── Attach issue counts to pages ──────────────────────────────────────────
  const counts = new Map<string, number>();
  for (const i of issues) if (i.path) counts.set(i.path, (counts.get(i.path) ?? 0) + 1);
  for (const p of pages) p.issueCount = counts.get(p.path) ?? 0;

  // De-duplicate by id (e.g. the same broken link listed twice in one article).
  const unique = [...new Map(issues.map((i) => [i.id, i])).values()];
  return { pages, issues: sortIssues(unique) };
}

export async function runSeoQualityChecks(now: Date = new Date()): Promise<SeoIssue[]> {
  return (await getSeoOverview(now)).issues;
}
