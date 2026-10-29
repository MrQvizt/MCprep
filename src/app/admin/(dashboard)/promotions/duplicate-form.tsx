"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { AdminForm, Field, NativeSelect, SubmitButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/urls";
import { duplicatePromotionAction } from "./actions";

/** "Reuse for another occasion" — copy a campaign (e.g. Halloween → Black Friday). */
export function DuplicatePromotion({ id, name, themes }: { id: string; name: string; themes: Record<string, string> }) {
  const [newName, setNewName] = useState("");
  const [slug, setSlug] = useState("");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Copy className="size-4" /> Reuse for another occasion
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reuse “{name}”</DialogTitle>
          <DialogDescription>
            Creates a copy with the same discount, wording and rules. The copy starts <strong>disabled</strong> with placeholder dates — set
            the real dates and discount, then enable it.
          </DialogDescription>
        </DialogHeader>
        <AdminForm action={duplicatePromotionAction.bind(null, id)} className="space-y-4">
          <Field label="New campaign name" name="name" required>
            {(fid) => (
              <Input
                id={fid}
                name="name"
                value={newName}
                placeholder="e.g. MC PREPS Black Friday"
                onChange={(e) => {
                  setNewName(e.target.value);
                  setSlug(slugify(e.target.value));
                }}
              />
            )}
          </Field>
          <Field label="Short code" name="slug" required>
            {(fid) => <Input id={fid} name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />}
          </Field>
          <Field label="Occasion" name="theme">
            {(fid) => (
              <NativeSelect id={fid} name="theme" defaultValue="BLACK_FRIDAY">
                {Object.entries(themes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <SubmitButton>Create copy</SubmitButton>
        </AdminForm>
      </DialogContent>
    </Dialog>
  );
}
