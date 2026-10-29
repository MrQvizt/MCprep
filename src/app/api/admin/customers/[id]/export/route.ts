import { exportCustomerData } from "@/lib/admin/customers";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin, AuthorizationError } from "@/lib/authz";

/** Download a customer's personal data (data-access request). Admin-only, audit-logged. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/customers/[id]/export">) {
  let admin;
  try {
    admin = await assertAdmin(AREA_ROLES.customers);
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not authorised", { status: 401 });
    throw error;
  }
  const { id } = await ctx.params;
  const data = await exportCustomerData(id);
  if (!data) return new Response("Not found", { status: 404 });
  await logAudit({
    actor: admin,
    action: "customer.export",
    entityType: "Customer",
    entityId: id,
    summary: "Downloaded the customer's personal data",
  });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="customer-data-${id}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
