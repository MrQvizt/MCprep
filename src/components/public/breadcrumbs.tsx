import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/shared/json-ld";
import { siteUrl } from "@/lib/env";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

export interface Crumb {
  name: string;
  path: string;
}

/** Visible breadcrumb trail + BreadcrumbList structured data. "Home" is added automatically. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className={cn("text-xs text-current/60", className)}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={c.path} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-current/90">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.path} className="hover:text-current hover:underline underline-offset-4">
                    {c.name}
                  </Link>
                )}
                {!last && <ChevronRight className="size-3 opacity-50" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(siteUrl(), all)} />
    </>
  );
}
