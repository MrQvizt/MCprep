import { InstagramIcon } from "@/components/shared/icons";
import { MediaImage } from "@/components/shared/media-image";
import type { MediaRef } from "@/lib/media";
import { isInstagramUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

export interface GalleryTile {
  id: string;
  caption: string | null;
  altText: string | null;
  instagramUrl: string | null;
  mediaAsset: MediaRef;
}

/** Instagram-style grid of uploaded photos; each tile opens the post (or profile). */
export function GalleryGrid({
  items,
  profileUrl,
  className,
  columns = "default",
}: {
  items: GalleryTile[];
  profileUrl: string | null;
  className?: string;
  columns?: "default" | "wide";
}) {
  if (items.length === 0) return null;
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2",
        columns === "wide" ? "lg:grid-cols-4" : "lg:grid-cols-6",
        className,
      )}
    >
      {items.map((item) => {
        const href = isInstagramUrl(item.instagramUrl) ? item.instagramUrl! : isInstagramUrl(profileUrl) ? profileUrl! : null;
        const alt = item.altText || item.mediaAsset.altText || item.caption || "MC PREPS on Instagram";
        const tile = (
          <>
            <MediaImage
              media={item.mediaAsset}
              alt={alt}
              sizes={columns === "wide" ? "(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" : "(min-width:1024px) 16vw, (min-width:640px) 33vw, 50vw"}
              className="absolute inset-0"
              imgClassName="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06]"
            />
            <span className="absolute inset-0 flex flex-col justify-between bg-ink/0 p-3 text-white opacity-0 transition-all duration-300 group-hover:bg-ink/55 group-hover:opacity-100 group-focus-visible:bg-ink/55 group-focus-visible:opacity-100">
              <InstagramIcon className="size-5 self-end" />
              {item.caption && <span className="line-clamp-3 text-xs leading-snug">{item.caption}</span>}
            </span>
          </>
        );
        return (
          <li key={item.id} className="group relative aspect-square overflow-hidden bg-charcoal">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                data-track="click_instagram"
                className="absolute inset-0 focus-visible:outline-offset-[-3px]"
                aria-label={`${item.caption || alt} — view on Instagram (opens in a new tab)`}
              >
                {tile}
              </a>
            ) : (
              tile
            )}
          </li>
        );
      })}
    </ul>
  );
}
