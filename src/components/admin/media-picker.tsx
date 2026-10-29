"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickedMedia {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
  filename?: string;
}

export const MEDIA_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General",
  MEAL: "Meals",
  HERO: "Hero & banners",
  GALLERY: "Instagram gallery",
  BLOG: "Blog",
  BRANDING: "Branding (logo, favicon)",
  SOCIAL: "Social sharing",
  PROMOTION: "Promotions",
  TESTIMONIAL: "Testimonials",
};

/** Upload a single file to the media library. */
export async function uploadMedia(file: File, category: string, altText?: string): Promise<PickedMedia> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("category", category);
  if (altText) fd.set("altText", altText);
  const res = await fetch("/api/admin/media", { method: "POST", body: fd });
  const json = (await res.json().catch(() => ({}))) as { item?: PickedMedia; error?: string };
  if (!res.ok || !json.item) throw new Error(json.error ?? "Upload failed");
  return json.item;
}

export function MediaLibraryDialog({
  open,
  onOpenChange,
  onSelect,
  category = "GENERAL",
  title = "Choose an image",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (m: PickedMedia) => void;
  category?: string;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; items: PickedMedia[]; pages: number } | null>(null);
  const requestKey = JSON.stringify({ page, q, filter, reloadKey });
  const loading = open && result?.key !== requestKey;
  const items = result?.items ?? [];
  const pages = result?.pages ?? 1;
  const [uploading, setUploading] = useState(false);
  const [alt, setAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (filter) params.set("category", filter);
    fetch(`/api/admin/media?${params}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<{ items: PickedMedia[]; pages: number }>)
      .then((json) => setResult({ key: requestKey, items: json.items ?? [], pages: json.pages ?? 1 }))
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        toast.error("Couldn't load the media library");
        setResult({ key: requestKey, items: [], pages: 1 });
      });
    return () => controller.abort();
  }, [open, page, q, filter, requestKey]);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const item = await uploadMedia(file, category, alt.trim() || undefined);
      toast.success("Image uploaded");
      setAlt("");
      setReloadKey((k) => k + 1);
      onSelect(item);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Upload a new photo or pick one from your library. JPG, PNG, WebP or AVIF up to 10 MB.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-dashed p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="upload-alt">
                Describe the image (alt text)
              </label>
              <Input id="upload-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Chicken Pokébowl with rice and greens" />
              <p className="text-xs text-muted-foreground">Helps visually impaired visitors and Google understand the photo.</p>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                id="upload-file"
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} size="lg">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? "Uploading…" : "Upload image"}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or alt text"
              className="pl-8"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border bg-background px-2 text-sm"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {Object.entries(MEDIA_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 min-h-40">
          {loading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No images yet. Upload your first photo above.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(m);
                      onOpenChange(false);
                    }}
                    className="group relative block aspect-square w-full overflow-hidden rounded-md border bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    title={m.altText || m.filename}
                  >
                    <Image src={m.url} alt={m.altText ?? ""} fill sizes="160px" className="object-cover transition-transform group-hover:scale-105" />
                    {!m.altText && (
                      <span className="absolute bottom-1 left-1 rounded bg-amber-100 px-1 text-[0.6rem] font-medium text-amber-900">No alt</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Button type="button" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Form field for choosing one image. Posts the media id in a hidden input.
 */
export function MediaPicker({
  name,
  defaultValue,
  category = "GENERAL",
  label = "Image",
  hint,
  aspect = "aspect-[4/3]",
  onChange,
}: {
  name: string;
  defaultValue?: PickedMedia | null;
  category?: string;
  label?: string;
  hint?: React.ReactNode;
  aspect?: string;
  onChange?: (m: PickedMedia | null) => void;
}) {
  const [value, setValue] = useState<PickedMedia | null>(defaultValue ?? null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const set = (m: PickedMedia | null) => {
    setValue(m);
    onChange?.(m);
  };
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <input type="hidden" name={name} value={value?.id ?? ""} />
      <div className="flex items-start gap-4" aria-labelledby={id}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "relative w-40 shrink-0 overflow-hidden rounded-md border bg-muted text-muted-foreground transition hover:border-ink",
            aspect,
          )}
        >
          {value ? (
            <Image src={value.url} alt={value.altText ?? ""} fill sizes="160px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center">
              <ImagePlus className="size-6" />
            </span>
          )}
        </button>
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              {value ? "Change image" : "Choose image"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" onClick={() => set(null)}>
                <Trash2 className="size-4" /> Remove
              </Button>
            )}
          </div>
          {value && !value.altText && (
            <p className="text-xs text-amber-700">This image has no alt text. Add it in the Media library.</p>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <MediaLibraryDialog open={open} onOpenChange={setOpen} onSelect={set} category={category} title={`Choose ${label.toLowerCase()}`} />
    </div>
  );
}
