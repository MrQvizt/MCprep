import { RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge, type Tone } from "@/components/admin/status-badge";
import { notificationRecipients } from "@/lib/admin/test-email";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { defaultFromAddress } from "@/lib/email/transport";
import { emailTransport, env } from "@/lib/env";
import { getMediaMap } from "@/lib/media";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { retryEmailAction } from "./actions";
import { BrandingForm } from "./forms/branding-form";
import { BusinessForm } from "./forms/business-form";
import { ContactForm } from "./forms/contact-form";
import { SendTestEmailButton } from "./forms/email-panel";
import { OrderFormForm } from "./forms/order-form-form";
import { SeoDefaultsForm } from "./forms/seo-form";
import { TrackingForm } from "./forms/tracking-form";
import { WebsiteForm } from "./forms/website-form";
import { SECTION_LINKS, SectionNav, type SectionKey } from "./section-nav";

export const metadata = { title: "Business settings" };

const EMAIL_STATUS_TONE: Record<string, Tone> = { PENDING: "info", SENDING: "info", SENT: "good", FAILED: "warn", DEAD: "bad" };
const EMAIL_STATUS_LABEL: Record<string, string> = {
  PENDING: "Queued",
  SENDING: "Sending",
  SENT: "Sent",
  FAILED: "Retrying",
  DEAD: "Failed",
};
const EMAIL_TYPE_LABEL: Record<string, string> = {
  ORDER_BUSINESS_NOTIFICATION: "New order (to you)",
  ORDER_CUSTOMER_CONFIRMATION: "Confirmation (to customer)",
  TEST: "Test email",
};

async function EmailSection() {
  const settings = await getSettings();
  const transport = emailTransport();
  const recipients = notificationRecipients(settings.contact);
  const [counts, recent] = await Promise.all([
    db.emailOutbox.groupBy({ by: ["status"], _count: { _all: true } }),
    db.emailOutbox.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, type: true, toAddress: true, subject: true, status: true, attempts: true, lastError: true, sentAt: true, createdAt: true },
    }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const providerLabel =
    transport === "resend" ? "Resend" : transport === "console" ? "Console (development — emails are only logged)" : "Not configured";
  const tz = settings.business.timeZone;

  return (
    <div className="space-y-6">
      <AdminCard title="Email delivery" description="Order notifications and customer confirmations are queued and retried automatically if sending fails.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Email provider</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium">
              <StatusBadge tone={transport === "resend" ? "good" : transport === "console" ? "info" : "bad"}>{providerLabel}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sent from</dt>
            <dd className="mt-1 font-medium">{defaultFromAddress()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">API key</dt>
            <dd className="mt-1 font-medium">{env().RESEND_API_KEY ? "Configured" : "Not set"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">New orders are emailed to</dt>
            <dd className="mt-1 font-medium">{recipients.length ? recipients.join(", ") : "Nobody yet — add an address in Contact & social"}</dd>
          </div>
        </dl>
        {transport === "disabled" && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Emails can&apos;t be sent until an email provider is set up. Orders are still saved and visible in the admin. Your
            developer needs to add <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> (see the README).
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <SendTestEmailButton disabled={recipients.length === 0} />
          <span className="text-xs text-muted-foreground">Sends to the order notification addresses.</span>
        </div>
      </AdminCard>

      <AdminCard title="Recent emails" description={`Queued ${count("PENDING") + count("SENDING")} · Sent ${count("SENT")} · Retrying ${count("FAILED")} · Failed ${count("DEAD")}`}>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emails yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {EMAIL_TYPE_LABEL[e.type] ?? e.type} · {e.toAddress} · {formatDateTime(e.createdAt, tz)}
                    {e.attempts > 0 ? ` · ${e.attempts} attempt(s)` : ""}
                  </p>
                  {e.lastError && e.status !== "SENT" && <p className="mt-1 line-clamp-2 text-xs text-destructive">{e.lastError}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={EMAIL_STATUS_TONE[e.status] ?? "neutral"}>{EMAIL_STATUS_LABEL[e.status] ?? e.status}</StatusBadge>
                  {(e.status === "FAILED" || e.status === "DEAD") && (
                    <ActionButton action={retryEmailAction.bind(null, e.id)} label="Retry now" variant="outline" size="sm">
                      <RotateCcw className="size-3.5" /> Retry
                    </ActionButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireAdmin(AREA_ROLES.settings);
  const sp = await searchParams;
  const requested = typeof sp.section === "string" ? sp.section : "business";
  const section: SectionKey = SECTION_LINKS.some((s) => s.key === requested) ? (requested as SectionKey) : "business";
  const label = SECTION_LINKS.find((s) => s.key === section)!.label;
  const settings = await getSettings();

  let body: React.ReactNode;
  switch (section) {
    case "business":
      body = <BusinessForm values={settings.business} />;
      break;
    case "contact":
      body = <ContactForm values={settings.contact} />;
      break;
    case "branding": {
      const b = settings.branding;
      const map = await getMediaMap([b.logoMediaId, b.logoAltMediaId, b.faviconMediaId, b.socialShareMediaId]);
      const get = (id: string | null) => (id ? (map.get(id) ?? null) : null);
      body = (
        <BrandingForm
          values={b}
          media={{ logo: get(b.logoMediaId), logoAlt: get(b.logoAltMediaId), favicon: get(b.faviconMediaId), share: get(b.socialShareMediaId) }}
        />
      );
      break;
    }
    case "order-form":
      body = <OrderFormForm values={settings.orderForm} />;
      break;
    case "email":
      body = <EmailSection />;
      break;
    case "website":
      body = <WebsiteForm values={settings.site} />;
      break;
    case "tracking":
      body = <TrackingForm values={settings.tracking} />;
      break;
    case "seo":
      body = <SeoDefaultsForm values={settings.seo} />;
      break;
  }

  return (
    <>
      <AdminPageHeader
        title="Business settings"
        description="Your business details, contact channels, branding and website options. Changes appear on the website straight away."
      />
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <SectionNav active={section} />
        <div className="min-w-0">
          {section === "email" ? (
            body
          ) : (
            <AdminCard title={label}>
              {/* key resets the form state when switching sections */}
              <div key={section}>{body}</div>
            </AdminCard>
          )}
        </div>
      </div>
    </>
  );
}
