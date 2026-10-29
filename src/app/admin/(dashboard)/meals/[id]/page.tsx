import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { EU_ALLERGENS } from "@/lib/admin/meals";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { MEDIA_SELECT } from "@/lib/media";
import { removeMeal } from "../actions";
import { MealForm } from "../meal-form";

export const metadata = { title: "Edit meal" };

export default async function EditMealPage({ params }: PageProps<"/admin/meals/[id]">) {
  await requireAdmin(AREA_ROLES.meals);
  const { id } = await params;
  const meal = await db.meal.findUnique({
    where: { id },
    include: {
      image: { select: MEDIA_SELECT },
      images: { orderBy: { sortOrder: "asc" }, include: { mediaAsset: { select: MEDIA_SELECT } } },
    },
  });
  if (!meal) notFound();
  const visible = meal.isPublished && !meal.archivedAt;

  return (
    <>
      <AdminPageHeader
        title={meal.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {meal.isDemo && <DemoBadge />}
            {meal.archivedAt ? "Archived — hidden from the website." : visible ? `Live at /menu/${meal.slug}` : "Hidden from the website."}
          </span>
        }
        back={{ href: "/admin/meals", label: "All meals" }}
        actions={
          <>
            {visible && (
              <Button asChild variant="outline">
                <Link href={`/menu/${meal.slug}`} target="_blank">
                  <ExternalLink className="size-4" /> View on site
                </Link>
              </Button>
            )}
            <ConfirmAction
              action={removeMeal.bind(null, meal.id)}
              title={`Delete “${meal.name}” permanently?`}
              description="This removes the meal for good. If you might bring it back, archive it instead. Photos stay in the media library."
              confirmLabel="Delete permanently"
              destructive
              variant="outline"
            >
              <Trash2 className="size-4" /> Delete
            </ConfirmAction>
          </>
        }
      />
      <MealForm
        allergens={EU_ALLERGENS}
        meal={{
          ...meal,
          image: meal.image,
          extraImages: meal.images.map((i) => i.mediaAsset),
        }}
      />
    </>
  );
}
