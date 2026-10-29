"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { MEDIA_CATEGORY_LABELS, uploadMedia } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";

/** Upload several images at once into the library. */
export function MultiUpload({ defaultCategory = "GENERAL" }: { defaultCategory?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 20);
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    for (const [i, file] of list.entries()) {
      try {
        await uploadMedia(file, category);
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
    if (ref.current) ref.current.value = "";
    if (ok > 0) {
      toast.success(`${ok} image(s) uploaded. Add a short description (alt text) to each one.`);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Category for new uploads"
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        {Object.entries(MEDIA_CATEGORY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="Choose images"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button type="button" size="lg" onClick={() => ref.current?.click()} disabled={progress !== null}>
        {progress ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {progress ? `Uploading ${progress.done}/${progress.total}…` : "Upload images"}
      </Button>
    </div>
  );
}

/** Replace the file behind a media record. */
export function ReplaceFile({ id }: { id: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/admin/media/${id}/replace`, { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Replace failed");
      toast.success("Image replaced everywhere it's used");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Replace failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="Choose replacement image"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Replace file
      </Button>
    </>
  );
}
