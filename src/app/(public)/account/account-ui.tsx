import Image from "next/image";
import { Check } from "lucide-react";

export const ACCOUNT_PERKS = [
  "Your details filled in on every order",
  "All your orders, dishes and payments in one place",
  "Order the same package again in two taps",
];

/** Split layout for sign-in / sign-up / reset: form on a light card, food photo + perks beside it. */
export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
  image = "/images/dishes/honey-sriracha-chicken-rice.webp",
}: {
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  image?: string;
}) {
  return (
    <section className="container-site py-10 sm:py-16">
      <div className="grid overflow-hidden border border-white/10 lg:grid-cols-[1.05fr_1fr]">
        <div className="light bg-paper px-5 py-10 text-ink sm:px-10 sm:py-14">
          <div className="mx-auto max-w-md">
            <p className="eyebrow text-smoke">{eyebrow}</p>
            <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">{title}</h1>
            {intro && <div className="mt-4 text-base leading-relaxed text-ink/70">{intro}</div>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t border-ink/10 pt-6 text-sm text-ink/70">{footer}</div>}
          </div>
        </div>
        <aside className="relative hidden min-h-[32rem] lg:block">
          <Image src={image} alt="" fill sizes="(min-width: 1024px) 45vw, 0px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-10">
            <p className="font-display text-3xl font-black uppercase leading-none">Your meal prep, sorted.</p>
            <ul className="mt-6 space-y-3 text-sm text-white/85">
              {ACCOUNT_PERKS.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="grid size-5 shrink-0 place-items-center bg-white text-ink">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Pull `next`, claim reference and claim token from page search params. */
export function authParams(sp: Record<string, string | string[] | undefined>) {
  const s = (k: string, max: number) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, max) : undefined);
  return { next: s("next", 300), claimRef: s("ref", 20), claimToken: s("t", 100) };
}

/** Carry the auth params over to the sibling page (sign-in ↔ sign-up). */
export function authQuery(p: { next?: string; claimRef?: string; claimToken?: string }) {
  const q = new URLSearchParams();
  if (p.next) q.set("next", p.next);
  if (p.claimRef && p.claimToken) {
    q.set("ref", p.claimRef);
    q.set("t", p.claimToken);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
