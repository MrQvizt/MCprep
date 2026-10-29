"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, X } from "lucide-react";
import { AdminCard } from "@/components/admin/page-header";
import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { MediaLibraryDialog, MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/urls";
import { saveMeal } from "./actions";

export interface MealFormValues {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  image: PickedMedia | null;
  extraImages: PickedMedia[];
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  servingSize: string | null;
  ingredients: string | null;
  nutritionSource: string | null;
  nutritionVerified: boolean;
  dietaryTags: string[];
  allergens: string[];
  label: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

function ExtraImages({ initial }: { initial: PickedMedia[] }) {
  const [images, setImages] = useState<PickedMedia[]>(initial);
  const [open, setOpen] = useState(false);
  const move = (i: number, d: -1 | 1) =>
    setImages((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <div className="space-y-3">
      {images.map((m) => (
        <input key={m.id} type="hidden" name="extraImageIds" value={m.id} />
      ))}
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((m, i) => (
            <li key={m.id} className="relative overflow-hidden rounded-md border bg-muted">
              <div className="relative aspect-square">
                <Image src={m.url} alt={m.altText ?? ""} fill sizes="160px" className="object-cover" />
              </div>
              <div className="flex items-center justify-between gap-1 p-1">
                <div className="flex">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Move left" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="-rotate-90" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Move right" disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="-rotate-90" />
                  </Button>
                </div>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove image" onClick={() => setImages((l) => l.filter((x) => x.id !== m.id))}>
                  <X />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={images.length >= 12}>
        <ImagePlus className="size-4" /> Add photo
      </Button>
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        category="MEAL"
        title="Add a meal photo"
        onSelect={(m) => setImages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]))}
      />
    </div>
  );
}

export function MealForm({ meal, allergens }: { meal?: MealFormValues; allergens: readonly string[] }) {
  const [name, setName] = useState(meal?.name ?? "");
  const [slug, setSlug] = useState(meal?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(meal));
  const slugChanged = meal ? slug !== meal.slug : false;

  return (
    <AdminForm action={saveMeal.bind(null, meal?.id ?? null)} className="space-y-6">
      <AdminCard title="Basics">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Meal name" name="name" required>
            {(id) => (
              <Input
                id={id}
                name="name"
                value={name}
                maxLength={120}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            )}
          </Field>
          <Field label="Web address" name="slug" required hint={`Shown as /menu/${slug || "…"}`}>
            {(id) => (
              <Input
                id={id}
                name="slug"
                value={slug}
                maxLength={80}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
              />
            )}
          </Field>
        </div>
        {slugChanged && meal?.isPublished && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <CheckboxField
              name="createRedirect"
              defaultChecked
              label="Send visitors from the old address to the new one (recommended)"
              hint={`Creates a permanent redirect from /menu/${meal.slug} so links and Google results keep working.`}
            />
          </div>
        )}
        <div className="mt-5 grid gap-5">
          <Field label="Short description" name="shortDescription" hint="One or two sentences for meal cards.">
            {(id) => <Textarea id={id} name="shortDescription" defaultValue={meal?.shortDescription ?? ""} rows={2} maxLength={300} />}
          </Field>
          <Field label="Full description (optional)" name="description" hint="Shown on the meal's own page. Leave a blank line between paragraphs.">
            {(id) => <Textarea id={id} name="description" defaultValue={meal?.description ?? ""} rows={5} maxLength={4000} />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Label (optional)" name="label" hint="Small badge on the card, e.g. Popular or New.">
              {(id) => <Input id={id} name="label" defaultValue={meal?.label ?? ""} maxLength={30} />}
            </Field>
            <Field label="Serving size (optional)" name="servingSize" hint="Only if confirmed, e.g. 450 g.">
              {(id) => <Input id={id} name="servingSize" defaultValue={meal?.servingSize ?? ""} maxLength={80} />}
            </Field>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Photos" description="Use real photos of your meals. The main photo appears on menu cards.">
        <div className="space-y-6">
          <MediaPicker name="imageId" label="Main photo" category="MEAL" defaultValue={meal?.image ?? null} aspect="aspect-[4/5]" />
          <div>
            <p className="mb-2 text-sm font-medium">More photos (optional)</p>
            <ExtraImages initial={meal?.extraImages ?? []} />
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="Nutrition"
        description="Only enter values you have verified from the recipe. Leave a box empty if you don't know it — empty values are simply not shown."
      >
        <div className="grid gap-5 sm:grid-cols-4">
          <Field label="Calories (kcal)" name="calories">
            {(id) => <Input id={id} name="calories" inputMode="numeric" defaultValue={meal?.calories ?? ""} />}
          </Field>
          <Field label="Protein (g)" name="proteinG">
            {(id) => <Input id={id} name="proteinG" inputMode="decimal" defaultValue={meal?.proteinG ?? ""} />}
          </Field>
          <Field label="Carbohydrates (g)" name="carbsG">
            {(id) => <Input id={id} name="carbsG" inputMode="decimal" defaultValue={meal?.carbsG ?? ""} />}
          </Field>
          <Field label="Fat (g)" name="fatG">
            {(id) => <Input id={id} name="fatG" inputMode="decimal" defaultValue={meal?.fatG ?? ""} />}
          </Field>
        </div>
        <div className="mt-5 grid gap-5">
          <Field label="Where do these figures come from?" name="nutritionSource" hint="Internal note, e.g. “Calculated from recipe, Oct 2026”.">
            {(id) => <Input id={id} name="nutritionSource" defaultValue={meal?.nutritionSource ?? ""} maxLength={500} />}
          </Field>
          <CheckboxField
            name="nutritionVerified"
            label="Nutrition values checked against the current recipe"
            defaultChecked={meal?.nutritionVerified ?? false}
          />
          <Field label="Ingredients (optional)" name="ingredients" hint="Only if you want to list them.">
            {(id) => <Textarea id={id} name="ingredients" defaultValue={meal?.ingredients ?? ""} rows={3} maxLength={2000} />}
          </Field>
        </div>
      </AdminCard>

      <AdminCard
        title="Dietary information & allergens"
        description="Tick only the allergens the meal actually contains, according to your recipe. Customers should always tell you about allergies when ordering."
      >
        <Field label="Dietary tags (optional)" name="dietaryTags" hint="Separate with commas, e.g. High protein, Gluten free.">
          {(id) => <Input id={id} name="dietaryTags" defaultValue={meal?.dietaryTags.join(", ") ?? ""} />}
        </Field>
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium">Contains these allergens</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allergens.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="allergens" value={a} defaultChecked={meal?.allergens.includes(a)} className="size-4 accent-ink" />
                {a}
              </label>
            ))}
          </div>
        </fieldset>
      </AdminCard>

      <AdminCard title="Visibility">
        <div className="space-y-3">
          <CheckboxField name="isPublished" label="Show on the website" defaultChecked={meal?.isPublished ?? true} />
          <CheckboxField name="isFeatured" label="Feature on the homepage" defaultChecked={meal?.isFeatured ?? false} />
        </div>
      </AdminCard>

      <AdminCard title="Google (optional)" description="Leave empty to use the meal name and short description.">
        <div className="grid gap-5">
          <Field label="SEO title" name="seoTitle" hint="Up to about 60 characters.">
            {(id) => <Input id={id} name="seoTitle" defaultValue={meal?.seoTitle ?? ""} maxLength={70} />}
          </Field>
          <Field label="SEO description" name="seoDescription" hint="Up to about 160 characters.">
            {(id) => <Textarea id={id} name="seoDescription" defaultValue={meal?.seoDescription ?? ""} rows={2} maxLength={170} />}
          </Field>
        </div>
      </AdminCard>

      <FormActions>
        <SubmitButton>{meal ? "Save meal" : "Create meal"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
