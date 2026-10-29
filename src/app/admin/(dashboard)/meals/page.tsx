import Image from "next/image";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Star, StarOff, Utensils } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { archiveMeal, moveMeal, toggleMeal } from "./actions";

export const metadata = { title: "Meals" };

const macro = (v: number | null, unit: string) => (v === null ? "—" : `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`);

export default async function MealsPage({ searchParams }: PageProps<"/admin/meals">) {
  await requireAdmin(AREA_ROLES.meals);
  const sp = await searchParams;
  const showArchived = sp.view === "archived";
  const [meals, archivedCount] = await Promise.all([
    db.meal.findMany({
      where: { archivedAt: showArchived ? { not: null } : null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { image: { select: { url: true, altText: true } } },
    }),
    db.meal.count({ where: { archivedAt: { not: null } } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Meals"
        description="Your menu. Add real photos and only the nutrition values you've verified. Use the arrows to set the order on the website."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/meals/new">
              <Plus className="size-4" /> New meal
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link
          href="/admin/meals"
          className={cn("rounded-full px-3 py-1", !showArchived ? "bg-ink text-white" : "bg-card text-muted-foreground ring-1 ring-border")}
        >
          On the menu
        </Link>
        <Link
          href="/admin/meals?view=archived"
          className={cn("rounded-full px-3 py-1", showArchived ? "bg-ink text-white" : "bg-card text-muted-foreground ring-1 ring-border")}
        >
          Archived ({archivedCount})
        </Link>
      </div>

      {meals.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title={showArchived ? "No archived meals" : "No meals yet"}
          description={showArchived ? "Archived meals are hidden from the website but kept here." : "Add your first meal with a photo and its macros."}
          action={
            !showArchived && (
              <Button asChild>
                <Link href="/admin/meals/new">Add a meal</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {meals.map((meal, i) => (
            <li key={meal.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                {meal.image ? (
                  <Image src={meal.image.url} alt={meal.image.altText ?? ""} fill sizes="64px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-[0.6rem] text-muted-foreground">No photo</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/meals/${meal.id}`} className="font-medium hover:underline">
                    {meal.name}
                  </Link>
                  {meal.isDemo && <DemoBadge />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground tabular">
                  {macro(meal.calories, " kcal")} · P {macro(meal.proteinG, "g")} · C {macro(meal.carbsG, "g")} · F {macro(meal.fatG, "g")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {meal.archivedAt ? (
                    <StatusBadge>Archived</StatusBadge>
                  ) : (
                    <StatusBadge tone={meal.isPublished ? "good" : "neutral"}>{meal.isPublished ? "On the website" : "Hidden"}</StatusBadge>
                  )}
                  {meal.isFeatured && <StatusBadge tone="info">Featured</StatusBadge>}
                  {meal.label && <StatusBadge>{meal.label}</StatusBadge>}
                  {!meal.nutritionVerified && meal.calories !== null && <StatusBadge tone="warn">Nutrition not verified</StatusBadge>}
                  {!meal.image && <StatusBadge tone="warn">Needs a photo</StatusBadge>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {!showArchived && (
                  <>
                    <ActionButton action={moveMeal.bind(null, meal.id, "up")} label="Move up" disabled={i === 0}>
                      <ArrowUp className="size-4" />
                    </ActionButton>
                    <ActionButton action={moveMeal.bind(null, meal.id, "down")} label="Move down" disabled={i === meals.length - 1}>
                      <ArrowDown className="size-4" />
                    </ActionButton>
                    <ActionButton action={toggleMeal.bind(null, meal.id, "isPublished")} label={meal.isPublished ? "Hide from website" : "Show on website"}>
                      {meal.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </ActionButton>
                    <ActionButton action={toggleMeal.bind(null, meal.id, "isFeatured")} label={meal.isFeatured ? "Un-feature" : "Feature on homepage"}>
                      {meal.isFeatured ? <StarOff className="size-4" /> : <Star className="size-4" />}
                    </ActionButton>
                  </>
                )}
                <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                  <Link href={`/admin/meals/${meal.id}`}>
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                {meal.archivedAt ? (
                  <ActionButton action={archiveMeal.bind(null, meal.id, false)} label="Restore">
                    <ArchiveRestore className="size-4" />
                  </ActionButton>
                ) : (
                  <ConfirmAction
                    action={archiveMeal.bind(null, meal.id, true)}
                    title={`Archive “${meal.name}”?`}
                    description="It will be hidden from the website but kept here, so you can restore it later."
                    confirmLabel="Archive"
                    variant="ghost"
                    size="icon-sm"
                  >
                    <Archive className="size-4" />
                    <span className="sr-only">Archive</span>
                  </ConfirmAction>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
