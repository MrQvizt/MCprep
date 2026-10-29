import { AdminPageHeader } from "@/components/admin/page-header";
import { EU_ALLERGENS } from "@/lib/admin/meals";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { MealForm } from "../meal-form";

export const metadata = { title: "New meal" };

export default async function NewMealPage() {
  await requireAdmin(AREA_ROLES.meals);
  return (
    <>
      <AdminPageHeader title="New meal" back={{ href: "/admin/meals", label: "All meals" }} />
      <MealForm allergens={EU_ALLERGENS} />
    </>
  );
}
