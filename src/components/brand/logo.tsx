import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BrandAssetsLite {
  logoText: string;
  logo: { url: string; width: number | null; height: number | null } | null;
}

/** Temporary text-based logo: white "MC" monogram block + PREPS wordmark. */
export function Wordmark({ text = "MC PREPS", className }: { text?: string; className?: string }) {
  const [first, ...rest] = text.trim().split(/\s+/);
  return (
    <span className={cn("inline-flex items-center gap-2 font-display uppercase leading-none", className)}>
      <span
        aria-hidden="true"
        className="inline-grid h-[1.9em] min-w-[1.9em] place-items-center bg-current px-[0.35em] text-[0.82em] font-black tracking-[-0.04em]"
      >
        <span className="[color:var(--wordmark-ink,#080808)]">{first}</span>
      </span>
      {rest.length > 0 && <span className="font-black tracking-[0.18em]">{rest.join(" ")}</span>}
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function Logo({
  brand,
  className,
  priority,
  inverted = false,
}: {
  brand: BrandAssetsLite;
  className?: string;
  priority?: boolean;
  /** true when shown on a light background */
  inverted?: boolean;
}) {
  if (brand.logo) {
    const ratio = brand.logo.width && brand.logo.height ? brand.logo.width / brand.logo.height : 3;
    const height = 36;
    return (
      <Image
        src={brand.logo.url}
        alt={brand.logoText}
        width={Math.round(height * ratio)}
        height={height}
        priority={priority}
        className={cn("h-9 w-auto", className)}
      />
    );
  }
  return (
    <Wordmark
      text={brand.logoText}
      className={cn(
        "text-lg",
        inverted ? "text-ink [--wordmark-ink:#ffffff]" : "text-white [--wordmark-ink:#080808]",
        className,
      )}
    />
  );
}
