import "server-only";
import { siteUrl } from "@/lib/env";
import { formatPhone, normalizePhone } from "@/lib/identity";
import type { AllSettings } from "@/lib/settings";

/** The one canonical set of business details to copy into every listing. */
export function canonicalBusinessDetails(settings: AllSettings) {
  const b = settings.business;
  const c = settings.contact;
  const phone = normalizePhone(c.phone);
  const address = [b.addressLine1, b.addressLine2, b.addressLocality, b.addressPostalCode].filter(Boolean).join(", ");
  return [
    { label: "Business name", value: b.tradingName },
    { label: "Phone", value: phone ? formatPhone(phone) : "" },
    { label: "Email", value: c.publicEmail },
    { label: "Website", value: siteUrl() },
    { label: "Address", value: address ? `${address}, Malta${b.showAddressPublicly ? "" : " (hidden publicly)"}` : "" },
    { label: "Area served", value: b.areaServedText },
    { label: "Instagram", value: c.instagramUrl },
  ];
}

export function detailsAsText(details: { label: string; value: string }[]) {
  return details
    .filter((d) => d.value)
    .map((d) => `${d.label}: ${d.value}`)
    .join("\n");
}
