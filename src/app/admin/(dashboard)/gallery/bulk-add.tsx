"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadMedia } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { bulkAddGallery } from "./actions";

/** Upload several photos and add them all to the gallery in one go. */
export function BulkAddGallery() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [, start] = useTransition();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 20);
    const ids: string[] = [];
    for (const [i, file] of list.entries()) {
      setProgress(`Uploading ${i + 1}/${list.length}…`);
      try {
        ids.push((await uploadMedia(file, "GALLERY")).id);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    if (ref.current) ref.current.value = "";
    if (ids.length === 0) {
      setProgress(null);
      return;
    }
    start(async () => {
      const res = await bulkAddGallery(ids);
      setProgress(null);
      if (res.ok) {
        toast.success(`${res.message}. Add the Instagram link and a description to each.`);
        router.refresh();
      } else toast.error(res.message ?? "Couldn't add the photos");
    });
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="Choose photos"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button type="button" variant="outline" size="lg" onClick={() => ref.current?.click()} disabled={progress !== null}>
        {progress ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {progress ?? "Upload several photos"}
      </Button>
    </>
  );
}
