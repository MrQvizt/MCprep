import Link from "next/link";
import { cn } from "@/lib/utils";

export const SECTION_LINKS = [
  { key: "business", label: "Business details" },
  { key: "contact", label: "Contact & social" },
  { key: "branding", label: "Logo & branding" },
  { key: "order-form", label: "Order form" },
  { key: "email", label: "Email notifications" },
  { key: "website", label: "Website notices" },
  { key: "tracking", label: "Analytics & tracking" },
  { key: "seo", label: "Search defaults" },
] as const;

export type SectionKey = (typeof SECTION_LINKS)[number]["key"];

export function SectionNav({ active }: { active: SectionKey }) {
  return (
    <nav aria-label="Settings sections" className="-mx-1 overflow-x-auto pb-1 lg:mx-0 lg:overflow-visible">
      <ul className="flex gap-1 px-1 lg:flex-col">
        {SECTION_LINKS.map((s) => (
          <li key={s.key}>
            <Link
              href={`/admin/settings?section=${s.key}`}
              aria-current={active === s.key ? "page" : undefined}
              className={cn(
                "block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active === s.key && "bg-ink text-white hover:bg-ink hover:text-white",
              )}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
