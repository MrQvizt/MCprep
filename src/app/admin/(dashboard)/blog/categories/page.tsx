import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteCategory, moveCategory } from "../actions";
import { CategoryForm } from "./category-form";

export const metadata = { title: "Blog categories" };

export default async function BlogCategoriesPage() {
  await requireAdmin(AREA_ROLES.blog);
  const categories = await db.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
  return (
    <>
      <AdminPageHeader title="Blog categories" description="Group articles by topic. The order here is the order on the blog page." back={{ href: "/admin/blog", label: "All articles" }} />
      <div className="space-y-6">
        <AdminCard title="Add a category">
          <CategoryForm />
        </AdminCard>
        <AdminCard title={`Categories (${categories.length})`}>
          <ul className="divide-y">
            {categories.map((c, i) => (
              <li key={c.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <CategoryForm category={c} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c._count.posts} article{c._count.posts === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ActionButton action={moveCategory.bind(null, c.id, "up")} label="Move up" disabled={i === 0}>
                    <ArrowUp className="size-4" />
                  </ActionButton>
                  <ActionButton action={moveCategory.bind(null, c.id, "down")} label="Move down" disabled={i === categories.length - 1}>
                    <ArrowDown className="size-4" />
                  </ActionButton>
                  <ConfirmAction
                    action={deleteCategory.bind(null, c.id)}
                    title={`Delete “${c.name}”?`}
                    description="Articles in this category stay published but become uncategorised."
                    confirmLabel="Delete"
                    destructive
                    variant="ghost"
                    size="icon-sm"
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete</span>
                  </ConfirmAction>
                </div>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </>
  );
}
