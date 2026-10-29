import { AdminPageHeader } from "@/components/admin/page-header";
import { getInternalLinkSuggestions } from "@/lib/admin/blog";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { BlogForm } from "../blog-form";
import { getEditorContext } from "../editor-data";

export const metadata = { title: "New article" };

export default async function NewBlogPostPage() {
  await requireAdmin(AREA_ROLES.blog);
  const [ctx, suggestions] = await Promise.all([
    getEditorContext(),
    getInternalLinkSuggestions({ title: "meal prep malta", primaryTopic: null, contentHtml: "" }),
  ]);
  return (
    <>
      <AdminPageHeader title="New article" back={{ href: "/admin/blog", label: "All articles" }} />
      <BlogForm {...ctx} suggestions={suggestions} />
    </>
  );
}
