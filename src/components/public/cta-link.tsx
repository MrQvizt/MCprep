import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const ctaVariants = cva(
  "group/cta inline-flex items-center justify-center gap-3 font-semibold uppercase tracking-[0.14em] transition-all duration-300 ease-[var(--ease-out-expo)] focus-visible:outline-2 focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        // White on dark backgrounds
        primary: "bg-white text-ink hover:bg-mist",
        // Black on light backgrounds
        dark: "bg-ink text-white hover:bg-charcoal",
        outline: "border border-current/40 text-current hover:border-current hover:bg-current/5",
        ghost: "text-current underline-offset-8 hover:underline px-0",
      },
      size: {
        sm: "h-10 px-4 text-[0.7rem]",
        md: "h-12 px-6 text-xs",
        lg: "h-14 px-8 text-[0.8rem]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function CtaLink({
  href,
  children,
  className,
  variant,
  size,
  arrow = true,
  prefetch,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  arrow?: boolean;
  prefetch?: boolean;
} & VariantProps<typeof ctaVariants> &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const external = /^https?:\/\//.test(href);
  const content = (
    <>
      <span className="inline-flex items-center gap-2">{children}</span>
      {arrow && (
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1"
        />
      )}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(ctaVariants({ variant, size }), className)} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={prefetch} className={cn(ctaVariants({ variant, size }), className)} {...rest}>
      {content}
    </Link>
  );
}
