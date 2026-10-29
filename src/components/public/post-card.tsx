import Link from "next/link";
import { MediaImage } from "@/components/shared/media-image";
import type { MediaRef } from "@/lib/media";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface PostCardData {
  title: string;
  slug: string;
  excerpt: string | null;
  coverAlt: string | null;
  publishAt: Date | null;
  createdAt: Date;
  isFeatured: boolean;
  coverImage: MediaRef | null;
  category: { name: string; slug: string } | null;
}

export function PostCard({ post, featured = false, className }: { post: PostCardData; featured?: boolean; className?: string }) {
  const date = post.publishAt ?? post.createdAt;
  return (
    <article className={cn("group relative flex flex-col", featured && "lg:grid lg:grid-cols-2 lg:gap-10", className)}>
      <div className={cn("relative overflow-hidden", featured ? "aspect-[16/10]" : "aspect-[4/3]")}>
        <MediaImage
          media={post.coverImage}
          alt={post.coverAlt ?? post.coverImage?.altText ?? ""}
          sizes={featured ? "(min-width:1024px) 50vw, 100vw" : "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"}
          className="absolute inset-0"
          imgClassName="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105"
        />
      </div>
      <div className={cn("flex flex-1 flex-col pt-5", featured && "lg:justify-center lg:pt-0")}>
        <p className="eyebrow flex flex-wrap gap-x-3 gap-y-1 text-current/60">
          {post.category && <span>{post.category.name}</span>}
          <time dateTime={date.toISOString()}>{formatDate(date)}</time>
        </p>
        <h3 className={cn("mt-3 font-display font-extrabold uppercase leading-[1.02]", featured ? "text-3xl sm:text-4xl" : "text-xl")}>
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 hover:underline underline-offset-4">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className={cn("mt-3 text-sm leading-relaxed text-current/70", featured && "sm:text-base")}>{post.excerpt}</p>}
        <span aria-hidden="true" className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] underline-offset-8 group-hover:underline">
          Read article →
        </span>
      </div>
    </article>
  );
}
