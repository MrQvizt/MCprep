import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BrandAssetsLite {
  logoText: string;
  logo: { url: string; width: number | null; height: number | null } | null;
}

/** The MC monogram (vector, traced from the brand logo). */
export function LogoMark({ className, onLight = false, priority }: { className?: string; onLight?: boolean; priority?: boolean }) {
  return (
    <Image
      src={onLight ? "/brand/mc-logo-dark.svg" : "/brand/mc-logo-light.svg"}
      alt=""
      width={1548}
      height={801}
      unoptimized
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}

/** MC monogram + wordmark ("PREPS"), used when no logo has been uploaded in the admin. */
export function Wordmark({
  text = "MC PREPS",
  className,
  onLight = false,
  priority,
}: {
  text?: string;
  className?: string;
  onLight?: boolean;
  priority?: boolean;
}) {
  const [first, ...rest] = text.trim().split(/\s+/);
  const isMc = first.toUpperCase() === "MC";
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-display uppercase leading-none", className)}>
      {isMc ? (
        <LogoMark onLight={onLight} priority={priority} className="h-[1.9em]" />
      ) : (
        <span aria-hidden="true" className="font-black">
          {first}
        </span>
      )}
      {rest.length > 0 && <span className="font-black tracking-[0.2em]">{rest.join(" ")}</span>}
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
      onLight={inverted}
      priority={priority}
      className={cn("text-lg", inverted ? "text-ink" : "text-white", className)}
    />
  );
}
