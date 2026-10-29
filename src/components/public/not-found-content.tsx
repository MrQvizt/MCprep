import Link from "next/link";
import { ArrowRight } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/plans", label: "Plans & pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function NotFoundContent() {
  return (
    <section className="relative overflow-hidden bg-ink text-white" aria-labelledby="nf-title">
      <div aria-hidden="true" className="pointer-events-none absolute -right-[4vw] bottom-[-6vw] select-none font-display text-[38vw] font-black leading-none tracking-tighter text-white/[0.04]">
        404
      </div>
      <div className="container-site relative py-24 sm:py-32 lg:py-40">
        <p className="eyebrow text-fog">Error 404</p>
        <h1 id="nf-title" className="mt-6 display-xl max-w-4xl text-balance">
          This page skipped leg day.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/75">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Try one of these instead:
        </p>
        <ul className="mt-10 grid max-w-xl border-t border-white/15">
          {LINKS.map((l) => (
            <li key={l.href} className="border-b border-white/15">
              <Link href={l.href} className="group flex items-center justify-between py-4 font-display text-xl font-extrabold uppercase">
                {l.label}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
