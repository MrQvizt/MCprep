import "server-only";
import { getPageSeo } from "@/lib/seo/metadata";
import type { StaticPageKey } from "@/lib/seo/pages";
import { getSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/whatsapp";

/** Breadcrumb for a fixed page (label is admin-editable in SEO settings). */
export async function crumbFor(key: StaticPageKey) {
  const seo = await getPageSeo(key);
  return { name: seo.breadcrumb, path: seo.def.path };
}

/** Inline WhatsApp link (null when no number is configured). */
export async function getWhatsappHref(message?: string) {
  const settings = await getSettings();
  return whatsappLink(settings.contact.whatsappNumber, message ?? settings.contact.whatsappDefaultMessage);
}
