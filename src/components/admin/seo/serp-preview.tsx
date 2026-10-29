"use client";

import { DESCRIPTION_RECOMMENDED_MAX, DESCRIPTION_RECOMMENDED_MIN, TITLE_RECOMMENDED_MAX } from "@/lib/seo/pages";
import { cn } from "@/lib/utils";

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")} …`;
}

export function CharacterCount({ value, min, max, label }: { value: string; min?: number; max: number; label: string }) {
  const n = value.trim().length;
  const tone = n === 0 ? "text-muted-foreground" : n > max ? "text-amber-700" : min && n < min ? "text-amber-700" : "text-emerald-700";
  const hint = n === 0 ? "" : n > max ? "may be cut off in Google" : min && n < min ? "a little short" : "good length";
  return (
    <span className={cn("block text-xs tabular", tone)} aria-live="polite">
      {label}: {n} characters{min ? ` (aim for ${min}–${max})` : ` (aim for up to ${max})`}
      {hint && ` — ${hint}`}
    </span>
  );
}

/** Approximation of a Google search result. Google may rewrite titles and descriptions. */
export function SerpPreview({ title, description, url, siteName }: { title: string; description: string; url: string; siteName: string }) {
  let display = url;
  try {
    const u = new URL(url);
    display = `${u.hostname}${u.pathname === "/" ? "" : u.pathname.split("/").filter(Boolean).map((s) => ` › ${s}`).join("")}`;
  } catch {
    /* keep raw */
  }
  return (
    <div className="rounded-lg border bg-white p-4 font-[arial,sans-serif] text-left shadow-xs" aria-label="Google search preview">
      <div className="flex items-center gap-3">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-[0.6rem] font-black text-white">MC</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm text-[#202124]">{siteName}</p>
          <p className="truncate text-xs text-[#4d5156]">{display}</p>
        </div>
      </div>
      <p className="mt-2 text-xl leading-snug text-[#1a0dab]">{truncate(title || "Page title", TITLE_RECOMMENDED_MAX + 5)}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#4d5156]">
        {description ? truncate(description, DESCRIPTION_RECOMMENDED_MAX) : <span className="italic">No description — Google will pick text from the page.</span>}
      </p>
      <p className="mt-3 border-t pt-2 text-[0.7rem] text-muted-foreground">
        Preview only. Google may rewrite titles and descriptions or show different text.
      </p>
    </div>
  );
}

/** WhatsApp / Facebook-style link preview card. */
export function SocialPreview({
  title,
  description,
  imageUrl,
  domain,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  domain: string;
}) {
  return (
    <div className="max-w-sm overflow-hidden rounded-lg border bg-[#f0f2f5] shadow-xs" aria-label="Social sharing preview">
      <div className="relative aspect-[1.91/1] bg-ink">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-display text-2xl font-black uppercase tracking-widest text-white">MC PREPS</div>
        )}
      </div>
      <div className="space-y-0.5 bg-white px-3 py-2.5">
        <p className="text-[0.7rem] uppercase text-[#65676b]">{domain}</p>
        <p className="line-clamp-2 text-sm font-semibold text-[#050505]">{title || "Page title"}</p>
        <p className="line-clamp-2 text-xs text-[#65676b]">{description}</p>
      </div>
    </div>
  );
}

export const LENGTHS = { TITLE_RECOMMENDED_MAX, DESCRIPTION_RECOMMENDED_MIN, DESCRIPTION_RECOMMENDED_MAX };
