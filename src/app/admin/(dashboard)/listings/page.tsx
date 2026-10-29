import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { ChecklistToggle } from "@/components/admin/seo/checklist-toggle";
import { CopyField } from "@/components/admin/seo/copy-field";
import { StatusBadge, type Tone } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/env";
import { GBP_ITEMS, getChecklist } from "@/lib/launch";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { setChecklistItemAction } from "../launch/actions";
import { deleteListing, moveListing } from "./actions";
import { canonicalBusinessDetails } from "./business-details";
import { GoogleProfileForm, LISTING_STATUS_LABELS, SearchConsoleForm } from "./forms";

export const metadata = { title: "Google & listings" };

const STATUS_TONE: Record<string, Tone> = {
  NOT_STARTED: "neutral",
  SUBMITTED: "info",
  PENDING_VERIFICATION: "warn",
  VERIFIED: "good",
  NEEDS_UPDATE: "warn",
  REJECTED: "bad",
};

export default async function ListingsPage() {
  await requireAdmin(AREA_ROLES.listings);
  const [settings, gbp, listings] = await Promise.all([
    getSettings(),
    getChecklist("gbp", GBP_ITEMS),
    db.businessListing.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const details = canonicalBusinessDetails(settings);
  const gbpDone = gbp.filter((g) => g.done).length;
  const verified = Boolean(settings.seo.googleSiteVerification);

  return (
    <>
      <AdminPageHeader
        title="Google & listings"
        description="Set up your free Google Business Profile, connect Google Search Console, and keep track of where MC PREPS is listed online."
      />
      <div className="space-y-8">
        <AdminCard
          title="Your official business details"
          description="Use exactly these details everywhere you're listed. Consistent name, phone and website help Google trust your business."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/settings">Edit in Business settings</Link>
            </Button>
          }
        >
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                <dd className="text-sm font-medium">{d.value || <span className="font-normal text-amber-700">Not set</span>}</dd>
              </div>
            ))}
          </dl>
        </AdminCard>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <AdminCard
            title="Google Business Profile checklist"
            description={`${gbpDone} of ${gbp.length} done. Google needs your access to create or verify a profile — this checklist guides you through it.`}
          >
            <ol className="space-y-4">
              {gbp.map((item) => (
                <li key={item.key} className="flex gap-3">
                  <ChecklistToggle done={item.done} label={item.title} action={setChecklistItemAction.bind(null, item.fullKey)} />
                  <div>
                    <p className={item.done ? "font-medium text-muted-foreground line-through" : "font-medium"}>{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer">
                  Open Google Business Profile <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </AdminCard>

          <div className="space-y-8">
            <AdminCard title="Profile & review links" description="Saved links appear on the website (footer and contact page).">
              <GoogleProfileForm profileUrl={settings.contact.googleBusinessProfileUrl} reviewUrl={settings.contact.googleReviewUrl} />
            </AdminCard>

            <AdminCard
              title="Google Search Console"
              description={
                <>
                  {verified ? <StatusBadge tone="good">Verification tag added</StatusBadge> : <StatusBadge tone="warn">Not verified yet</StatusBadge>}
                </>
              }
            >
              <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Open Search Console and add your website as a property.</li>
                <li>Choose the HTML tag method, paste it below and save.</li>
                <li>Click Verify in Search Console.</li>
                <li>Submit your sitemap (address below) under Sitemaps.</li>
              </ol>
              <SearchConsoleForm
                google={settings.seo.googleSiteVerification}
                bing={settings.seo.bingSiteVerification}
                property={settings.seo.searchConsolePropertyUrl}
              />
              <div className="mt-6 space-y-2">
                <p className="text-sm font-medium">Your sitemap address</p>
                <CopyField value={absoluteUrl("/sitemap.xml")} label="Sitemap address" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                    Open Search Console <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer">
                    Open Bing Webmaster Tools <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>
              <p className="mt-5 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                No Search Console data connection is set up, so this website doesn&apos;t show search clicks, impressions or positions — open Search Console to see
                them. A direct connection (Search Console API) can be added later by a developer; until then no search figures are shown here.
              </p>
            </AdminCard>
          </div>
        </div>

        <AdminCard
          title="Listing tracker"
          description="Record where MC PREPS is listed (Google, Apple Business Connect, Bing Places, relevant Malta directories). Only add quality, relevant listings — and only mark one verified when the platform confirms it."
          actions={
            <Button asChild size="sm">
              <Link href="/admin/listings/new">
                <Plus className="size-4" /> Add listing
              </Link>
            </Button>
          }
        >
          {listings.length === 0 ? (
            <EmptyState icon={MapPin} title="No listings tracked yet" description="Start with Google Business Profile, Apple Business Connect and Bing Places." />
          ) : (
            <ul className="divide-y">
              {listings.map((l, i) => (
                <li key={l.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/listings/${l.id}`} className="font-medium hover:underline">
                        {l.platform}
                      </Link>
                      <StatusBadge tone={STATUS_TONE[l.status] ?? "neutral"}>{LISTING_STATUS_LABELS[l.status] ?? l.status}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.submittedAt ? `Submitted ${formatDate(l.submittedAt)}` : "Not submitted"}
                      {l.lastCheckedAt ? ` · Last checked ${formatDate(l.lastCheckedAt)}` : ""}
                      {l.url ? (
                        <>
                          {" · "}
                          <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            Open listing
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ActionButton action={moveListing.bind(null, l.id, "up")} label="Move up" disabled={i === 0}>
                      <ArrowUp className="size-4" />
                    </ActionButton>
                    <ActionButton action={moveListing.bind(null, l.id, "down")} label="Move down" disabled={i === listings.length - 1}>
                      <ArrowDown className="size-4" />
                    </ActionButton>
                    <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                      <Link href={`/admin/listings/${l.id}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <ConfirmAction
                      action={deleteListing.bind(null, l.id)}
                      title={`Remove ${l.platform} from the tracker?`}
                      description="This only removes it from your list here — it doesn't delete the listing on that platform."
                      confirmLabel="Remove"
                      destructive
                      variant="ghost"
                      size="icon-sm"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove</span>
                    </ConfirmAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </>
  );
}
