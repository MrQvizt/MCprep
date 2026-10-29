import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/authz";

// Placeholder — replaced by the full dashboard overview.
export default async function AdminDashboardPage() {
  const admin = await requireAdmin("EDITOR");
  return <AdminPageHeader title={`Welcome, ${admin.name.split(" ")[0]}`} description="Dashboard coming together." />;
}
