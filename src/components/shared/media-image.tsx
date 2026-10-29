import Image from "next/image";
import { cn } from "@/lib/utils";

export interface MediaLike {
  url: string;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
}

/**
 * next/image wrapper that falls back to tasteful monochrome placeholder art
 * when no photo has been uploaded yet.
 */
export function MediaImage({
  media,
  alt,
  sizes = "100vw",
  priority,
  className,
  imgClassName,
  placeholderLabel,
  quality,
}: {
  media: MediaLike | null | undefined;
  alt?: string | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  placeholderLabel?: string;
  quality?: number;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-charcoal", className)}>
      {media ? (
        <Image
          src={media.url}
          alt={alt ?? media.altText ?? ""}
          fill
          sizes={sizes}
          priority={priority}
          quality={quality}
          className={cn("object-cover", imgClassName)}
        />
      ) : (
        <PlaceholderArt label={placeholderLabel} />
      )}
    </div>
  );
}

export function PlaceholderArt({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_80%_10%,#2a2a2a_0%,#121212_45%,#080808_100%)]",
        className,
      )}
    >
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]" />
      <svg viewBox="0 0 200 120" className="absolute -bottom-[8%] -right-[6%] w-[75%] text-white/[0.06]" aria-hidden="true">
        <text x="0" y="110" fontFamily="var(--font-display)" fontWeight={900} fontSize="128" fill="currentColor" letterSpacing="-6">
          MC
        </text>
      </svg>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
