import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ShieldX } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { findWebsiteAccounts } from "@/lib/admin/customer-accounts";
import { customerStatus, getCustomerDetail } from "@/lib/admin/customers";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { formatPhone } from "@/lib/identity";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { DetailRow, EligibilityBadge, OrderStatusBadge } from "../../orders/order-ui";
import { anonymizeCustomerAction, withdrawConsentAction } from "../actions";
import { CustomerNotesForm, CustomerStatusForm, WebsiteAccountTools } from "./customer-forms";

export const metadata = { title: "Customer" };

const REDEMPTION_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export default async function CustomerDetailPage({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  await requireAdmin(AREA_ROLES.customers);
  const { id } = await params;
  const sp = await searchParams;
  const [customer, settings] = await Promise.all([getCustomerDetail(id), getSettings()]);
  if (!customer) notFound();
  const accounts = customer.anonymizedAt
    ? []
    : await findWebsiteAccounts({ email: customer.email, orderIds: customer.orders.map((o) => o.id) });
  const tz = settings.business.timeZone;
  const status = customerStatus(customer);
  const anonymised = Boolean(customer.anonymizedAt);

  return (
    <>
      <AdminPageHeader
        back={{ href: "/admin/customers", label: "All customers" }}
        title={customer.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <span>
              {customer.orders.length} order{customer.orders.length === 1 ? "" : "s"} · {customer.servedOrders} confirmed or completed
            </span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href={`/admin/orders?customer=${customer.id}`}>View orders</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={`/api/admin/customers/${customer.id}/export`}>
                <Download className="size-4" /> Export data
              </a>
            </Button>
          </>
        }
      />

      {(sp.anonymised === "1" || anonymised) && (
        <p className="mb-6 rounded-lg border bg-muted px-4 py-3 text-sm" role="status">
          Personal data was removed{customer.anonymizedAt ? ` on ${formatDateTime(customer.anonymizedAt, tz)}` : ""}. Order pricing and
          statuses are kept for your accounting records.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <AdminCard title="Contact details">
            <dl className="divide-y">
              <DetailRow label="Name">{customer.name}</DetailRow>
              <DetailRow label="Email">{customer.email}</DetailRow>
              <DetailRow label="Phone">{customer.phone ? formatPhone(customer.phone) : null}</DetailRow>
              <DetailRow label="First order">{customer.firstOrderAt ? formatDateTime(customer.firstOrderAt, tz) : null}</DetailRow>
              <DetailRow label="Latest order">{customer.lastOrderAt ? formatDateTime(customer.lastOrderAt, tz) : null}</DetailRow>
            </dl>
            {customer.identities.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-medium">Matching details</p>
                <p className="text-xs text-muted-foreground">
                  Future order requests using any of these are linked to this customer (used for first-order checks).
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {customer.identities.map((i) => (
                    <li key={i.id}>
                      <StatusBadge>
                        {i.type === "EMAIL" ? "Email" : "Phone"}: {i.type === "PHONE" ? formatPhone(i.value) : i.value}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AdminCard>

          <AdminCard title="Orders">
            {customer.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders linked to this customer.</p>
            ) : (
              <ul className="divide-y">
                {customer.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold hover:underline">
                      {o.reference}
                    </Link>
                    <OrderStatusBadge status={o.status} />
                    <EligibilityBadge status={o.eligibilityStatus} />
                    <span className="text-muted-foreground">
                      {o.planName}
                      {o.promotionName ? ` · ${o.promotionName}` : ""}
                    </span>
                    <span className="ml-auto tabular">
                      {o.confirmedTotalCents !== null
                        ? formatMoney(o.confirmedTotalCents, o.currency)
                        : o.totalCents !== null
                          ? formatMoney(o.totalCents, o.currency)
                          : "On request"}
                    </span>
                    <span className="w-full text-xs text-muted-foreground">{formatDateTime(o.createdAt, tz)}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Promotions used">
            {customer.redemptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No promotions requested.</p>
            ) : (
              <ul className="divide-y text-sm">
                {customer.redemptions.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-medium">{r.promotion.name}</span>
                    <StatusBadge tone={r.status === "APPROVED" ? "good" : r.status === "REJECTED" ? "bad" : "neutral"}>
                      {REDEMPTION_LABELS[r.status] ?? r.status}
                    </StatusBadge>
                    <span className="ml-auto text-muted-foreground">{formatDateTime(r.createdAt, tz, { dateStyle: "medium" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            title="Marketing consent"
            description="Customers are never subscribed automatically — only when they tick the separate marketing box."
          >
            {customer.marketingConsents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No marketing consent recorded.</p>
            ) : (
              <ul className="divide-y text-sm">
                {customer.marketingConsents.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={c.status === "GRANTED" ? "good" : "neutral"}>{c.status === "GRANTED" ? "Subscribed" : "Withdrawn"}</StatusBadge>
                      <span>{c.email}</span>
                      <span className="text-muted-foreground">
                        · {c.channel.toLowerCase()} · {formatDateTime(c.grantedAt, tz, { dateStyle: "medium" })}
                        {c.withdrawnAt ? ` · withdrawn ${formatDateTime(c.withdrawnAt, tz, { dateStyle: "medium" })}` : ""}
                      </span>
                      {c.status === "GRANTED" && (
                        <ConfirmAction
                          action={withdrawConsentAction.bind(null, customer.id, c.id)}
                          title="Record that this customer unsubscribed?"
                          description="They won't receive marketing emails. Order emails are not affected."
                          confirmLabel="Withdraw consent"
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                        >
                          Withdraw
                        </ConfirmAction>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Wording shown: “{c.consentText}”</p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <div className="space-y-6">
          {!anonymised && (
            <AdminCard
              title={accounts.length > 1 ? "Website accounts" : "Website account"}
              description={accounts.length ? undefined : "They haven't created an account on the website. They can still order without one."}
            >
              {accounts.length > 0 ? (
                <div className="space-y-6">
                  {accounts.map((account) => (
                    <section key={account.id} aria-label={`Website account ${account.email}`} className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0">
                      <dl>
                        <DetailRow label="Login email">{account.email}</DetailRow>
                        <DetailRow label="Name">{account.name}</DetailRow>
                        <DetailRow label="Created">{formatDateTime(account.createdAt, tz, { dateStyle: "medium" })}</DetailRow>
                        <DetailRow label="Last sign-in">{account.lastLoginAt ? formatDateTime(account.lastLoginAt, tz) : "Never"}</DetailRow>
                        <DetailRow label="Orders saved">{String(account._count.orders)}</DetailRow>
                      </dl>
                      <WebsiteAccountTools customerId={customer.id} accountId={account.id} email={account.email} />
                    </section>
                  ))}
                </div>
              ) : null}
            </AdminCard>
          )}
          {!anonymised && (
            <AdminCard title="Customer type">
              <CustomerStatusForm key={customer.manualStatus ?? "AUTO"} customerId={customer.id} current={customer.manualStatus ?? "AUTO"} />
            </AdminCard>
          )}
          {!anonymised && (
            <AdminCard title="Notes about this customer">
              <CustomerNotesForm customerId={customer.id} notes={customer.notes} />
            </AdminCard>
          )}
          {customer.history.length > 0 && (
            <AdminCard title="Change history">
              <ul className="space-y-3 text-sm">
                {customer.history.map((h) => (
                  <li key={h.id}>
                    <p>{h.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.actorEmail ?? "System"} · {formatDateTime(h.createdAt, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}
          <AdminCard
            title="Privacy requests"
            description="Use these when a customer asks for a copy of their data or asks you to delete it."
          >
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Copy of their data</p>
                <p className="text-muted-foreground">Download everything stored about this customer as a file you can send them.</p>
                <Button asChild variant="outline" className="mt-2">
                  <a href={`/api/admin/customers/${customer.id}/export`}>
                    <Download className="size-4" /> Download data (JSON)
                  </a>
                </Button>
              </div>
              {!anonymised && (
                <div className="border-t pt-4">
                  <p className="font-medium">Remove personal data</p>
                  <p className="text-muted-foreground">
                    Removes their name, contact details, address, preferences, allergy notes and internal notes from this customer and
                    all their orders. Prices and statuses stay for your accounting. If they order again they&apos;ll appear as a new
                    customer. Check with your adviser whether you must keep anything longer first.
                  </p>
                  <ConfirmAction
                    action={anonymizeCustomerAction.bind(null, customer.id)}
                    title="Remove this customer's personal data?"
                    description="This can't be undone. Their orders stay in your records without any personal details."
                    confirmLabel="Remove personal data"
                    destructive
                    className="mt-2"
                  >
                    <ShieldX className="size-4" /> Remove personal data
                  </ConfirmAction>
                </div>
              )}
            </div>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
