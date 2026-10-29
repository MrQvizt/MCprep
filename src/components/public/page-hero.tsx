import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { cn } from "@/lib/utils";

/** Header for inner pages: breadcrumbs, eyebrow, single H1, intro. */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  intro,
  children,
  aside,
  className,
  size = "xl",
}: {
  crumbs: Crumb[];
  eyebrow?: string | null;
  title: string;
  intro?: string | null;
  children?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  size?: "2xl" | "xl" | "lg";
}) {
  return (
    <header className={cn("relative overflow-hidden border-b border-white/10 bg-ink text-white", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="container-site relative pb-14 pt-8 sm:pb-20 sm:pt-10 lg:pb-24">
        <Breadcrumbs items={crumbs} />
        <div className={cn("mt-10 grid gap-10 sm:mt-14", aside && "lg:grid-cols-[1.4fr_1fr] lg:items-end")}>
          <div className="max-w-4xl">
            {eyebrow && <p className="eyebrow mb-5 text-fog">{eyebrow}</p>}
            <h1 className={cn(size === "2xl" ? "display-2xl" : size === "xl" ? "display-xl" : "display-lg", "text-balance")}>{title}</h1>
            {intro && <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg text-pretty">{intro}</p>}
            {children && <div className="mt-8">{children}</div>}
          </div>
          {aside && <div>{aside}</div>}
        </div>
      </div>
    </header>
  );
}
