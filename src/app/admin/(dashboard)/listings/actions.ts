"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fdOptional, fdString, fail, handleActionError, ok, type ActionState } from "@/lib/actions";
import { extractVerificationCode } from "@/lib/admin/blog-utils";
import { moveItem, nextSortOrder } from "@/lib/admin/reorder";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { revalidatePublicSite } from "@/lib/revalidate";
import { updateSettingsGroup } from "@/lib/settings";
import { DEFAULT_TIME_ZONE, zonedLocalToUtc } from "@/lib/time";
import { isSafeHttpUrl } from "@/lib/urls";
import { ListingStatus } from "@/generated/prisma/enums";

const httpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || "")
    .refine((v) => v === "" || (isSafeHttpUrl(v) && v.startsWith("https://")), `${label} must be a full https:// link.`);

export async function saveGoogleProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.listings);
    const data = z
      .object({ googleBusinessProfileUrl: httpsUrl("The profile link"), googleReviewUrl: httpsUrl("The review link") })
      .parse({ googleBusinessProfileUrl: fdString(fd, "googleBusinessProfileUrl"), googleReviewUrl: fdString(fd, "googleReviewUrl") });
    await updateSettingsGroup("contact", data, admin.id);
    await logAudit({ actor: admin, action: "settings.google_profile", entityType: "SiteSetting", entityId: "contact", summary: "Updated Google Business Profile links", changes: data });
    revalidatePath("/admin/listings");
    revalidatePublicSite();
    return ok("Google Business Profile links saved");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function saveSearchConsole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.listings);
    const google = extractVerificationCode(fdString(fd, "googleSiteVerification"));
    const bing = extractVerificationCode(fdString(fd, "bingSiteVerification"));
    const fieldErrors: Record<string, string> = {};
    if (google === null) fieldErrors.googleSiteVerification = "Paste the whole meta tag from Search Console, or just the code inside content=\"…\".";
    if (bing === null) fieldErrors.bingSiteVerification = "Paste the whole meta tag from Bing, or just the code inside content=\"…\".";
    const property = fdString(fd, "searchConsolePropertyUrl");
    if (property && !(isSafeHttpUrl(property) || /^sc-domain:[a-z0-9.-]+$/i.test(property))) {
      fieldErrors.searchConsolePropertyUrl = "Use your website address (https://…) or a domain property like sc-domain:example.com.";
    }
    if (Object.keys(fieldErrors).length) return fail("Please check the highlighted fields.", fieldErrors);
    const patch = {
      googleSiteVerification: google ?? "",
      bingSiteVerification: bing ?? "",
      searchConsolePropertyUrl: property.slice(0, 300),
    };
    await updateSettingsGroup("seo", patch, admin.id);
    await logAudit({ actor: admin, action: "settings.search_console", entityType: "SiteSetting", entityId: "seo", summary: "Updated search engine verification", changes: patch });
    revalidatePath("/admin/listings");
    revalidatePublicSite();
    return ok("Search engine verification saved");
  } catch (error) {
    return handleActionError(error);
  }
}

const listingSchema = z.object({
  platform: z.string().trim().min(2, "Name the platform, e.g. Bing Places.").max(80),
  url: httpsUrl("The listing link").transform((v) => v || null),
  status: z.enum(Object.values(ListingStatus) as [ListingStatus, ...ListingStatus[]]),
  submittedAt: z.date().nullable(),
  lastCheckedAt: z.date().nullable(),
  detailsUsed: z.string().trim().max(1000).nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

function dateField(fd: FormData, name: string): Date | null | "invalid" {
  const v = fdString(fd, name);
  if (!v) return null;
  return zonedLocalToUtc(`${v}T12:00`, DEFAULT_TIME_ZONE) ?? "invalid";
}

export async function saveListing(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let created = false;
  try {
    const admin = await assertAdmin(AREA_ROLES.listings);
    const submittedAt = dateField(fd, "submittedAt");
    const lastCheckedAt = dateField(fd, "lastCheckedAt");
    if (submittedAt === "invalid" || lastCheckedAt === "invalid") return fail("Please check the dates.");
    const data = listingSchema.parse({
      platform: fdString(fd, "platform"),
      url: fdString(fd, "url"),
      status: fdString(fd, "status") || "NOT_STARTED",
      submittedAt,
      lastCheckedAt,
      detailsUsed: fdOptional(fd, "detailsUsed"),
      notes: fdOptional(fd, "notes"),
    });
    if (id) {
      await db.businessListing.update({ where: { id }, data });
    } else {
      await db.businessListing.create({ data: { ...data, sortOrder: await nextSortOrder("businessListing") } });
      created = true;
    }
    await logAudit({ actor: admin, action: id ? "listing.update" : "listing.create", entityType: "BusinessListing", entityId: id, summary: `${id ? "Updated" : "Added"} listing ${data.platform} (${data.status})` });
    revalidatePath("/admin/listings");
  } catch (error) {
    return handleActionError(error);
  }
  if (created) redirect("/admin/listings?added=1");
  return ok("Listing saved");
}

export async function deleteListing(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.listings);
    const listing = await db.businessListing.delete({ where: { id } });
    await logAudit({ actor: admin, action: "listing.delete", entityType: "BusinessListing", entityId: id, summary: `Removed listing ${listing.platform}` });
    revalidatePath("/admin/listings");
    return ok("Listing removed from the tracker");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function moveListing(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.listings);
    await moveItem("businessListing", id, direction);
    revalidatePath("/admin/listings");
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
