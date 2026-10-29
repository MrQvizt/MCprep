"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Eye, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminForm, CheckboxField, Field, FormActions, NativeSelect, SubmitButton, useFormState } from "@/components/admin/form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DateTimeInput } from "@/components/admin/inputs";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { CharacterCount, LENGTHS, SerpPreview } from "@/components/admin/seo/serp-preview";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { countWords, readingMinutes, THIN_CONTENT_WORDS, type BlogVisibility, type LinkSuggestion } from "@/lib/admin/blog-utils";
import { slugify } from "@/lib/urls";
import { createPreviewLink, deleteBlogPost, saveBlogPost } from "./actions";

export interface BlogFormPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string;
  coverImage: PickedMedia | null;
  coverAlt: string | null;
  categoryId: string | null;
  authorName: string | null;
  authorBio: string | null;
  authorUrl: string | null;
  isFeatured: boolean;
  needsReview: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  primaryTopic: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: PickedMedia | null;
  canonicalUrl: string | null;
  noindex: boolean;
  visibility: BlogVisibility;
  publishAt: Date | null;
  publishAtLabel: string | null;
  contentUpdatedAtLabel: string;
  previewUrl: string | null;
}

const VISIBILITY_TONE = { DRAFT: "neutral", SCHEDULED: "info", PUBLISHED: "good" } as const;
const VISIBILITY_LABEL = { DRAFT: "Draft", SCHEDULED: "Scheduled", PUBLISHED: "Published" } as const;

function FieldErrorText({ name }: { name: string }) {
  const state = useFormState();
  const e = state.fieldErrors?.[name];
  return e ? <p className="text-xs font-medium text-destructive">{e}</p> : null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — select the text and copy it manually.");
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export function BlogForm({
  post,
  categories,
  suggestions,
  siteUrl,
  siteName,
  titleSuffix,
}: {
  post?: BlogFormPost;
  categories: { id: string; name: string }[];
  suggestions: LinkSuggestion[];
  siteUrl: string;
  siteName: string;
  titleSuffix: string;
}) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "");
  const [html, setHtml] = useState(post?.contentHtml ?? "");
  const [needsReview, setNeedsReview] = useState(post?.needsReview ?? true);
  const [previewUrl, setPreviewUrl] = useState(post?.previewUrl ?? null);
  const [pendingPreview, startPreview] = useTransition();

  const words = countWords(html);
  const visibility = post?.visibility ?? "DRAFT";
  const live = visibility === "PUBLISHED";
  const effectiveSlug = slug || slugify(title);
  const effectiveTitle = seoTitle.trim() || `${title || "Article title"} | ${titleSuffix}`;
  const effectiveDescription = seoDescription.trim() || excerpt.trim();

  return (
    <AdminForm action={saveBlogPost.bind(null, post?.id ?? null)} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-8">
        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <Field label="Title" name="title" required>
            {(id) => (
              <Input
                id={id}
                name="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                maxLength={160}
                className="h-11 text-base"
              />
            )}
          </Field>
          <Field
            label="Web address"
            name="slug"
            hint={
              <>
                {siteUrl}/blog/<strong>{effectiveSlug || "…"}</strong>
              </>
            }
          >
            {(id) => (
              <Input
                id={id}
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                maxLength={80}
                className="font-mono text-sm"
              />
            )}
          </Field>
          {live && post && slug !== post.slug && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p>You&apos;re changing the address of a live article. Links shared before will stop working unless you redirect them.</p>
              <div className="mt-2">
                <CheckboxField name="createRedirect" defaultChecked label={`Redirect /blog/${post.slug} to the new address (recommended)`} />
              </div>
            </div>
          )}
          <Field label="Summary" name="excerpt" hint="One or two sentences shown on the blog page and used in Google if you don't write an SEO description.">
            {(id) => <Textarea id={id} name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={300} />}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Article</p>
            <RichTextEditor name="contentHtml" defaultValue={post?.contentHtml ?? ""} onChange={setHtml} placeholder="Write something genuinely useful for people in Malta…" />
            <FieldErrorText name="contentHtml" />
            <p className="text-xs text-muted-foreground">
              {words} words · {readingMinutes(words)} min read
              {words > 0 && words < THIN_CONTENT_WORDS && ` · Aim for at least ${THIN_CONTENT_WORDS} words so the article is useful in Google.`}
            </p>
          </div>
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Cover & author</h2>
          <MediaPicker name="coverImageId" label="Cover image" category="BLOG" defaultValue={post?.coverImage ?? null} aspect="aspect-[16/9]" />
          <FieldErrorText name="coverImageId" />
          <Field label="Cover image description (alt text)" name="coverAlt" hint="Describe what's in the photo.">
            {(id) => <Input id={id} name="coverAlt" defaultValue={post?.coverAlt ?? ""} maxLength={200} />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" name="categoryId">
              {(id) => (
                <NativeSelect id={id} name="categoryId" defaultValue={post?.categoryId ?? ""}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Author name" name="authorName" hint="Only credit real people. Leave as MC PREPS if unsure.">
              {(id) => <Input id={id} name="authorName" defaultValue={post?.authorName ?? "MC PREPS"} maxLength={80} />}
            </Field>
          </div>
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">Author details (optional)</summary>
            <div className="mt-4 space-y-4">
              <Field label="Short bio" name="authorBio" hint="Mention real qualifications only (e.g. a registered dietitian who reviewed the article).">
                {(id) => <Textarea id={id} name="authorBio" defaultValue={post?.authorBio ?? ""} rows={2} maxLength={500} />}
              </Field>
              <Field label="Author link" name="authorUrl" hint="e.g. their professional profile (https://…)">
                {(id) => <Input id={id} name="authorUrl" defaultValue={post?.authorUrl ?? ""} maxLength={300} />}
              </Field>
            </div>
          </details>
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold">Google & sharing</h2>
            <p className="mt-1 text-sm text-muted-foreground">Optional — sensible defaults are used when empty.</p>
          </div>
          <SerpPreview title={effectiveTitle} description={effectiveDescription} url={`${siteUrl}/blog/${effectiveSlug}`} siteName={siteName} />
          <Field label="Google title" name="seoTitle" hint={<CharacterCount value={effectiveTitle} max={LENGTHS.TITLE_RECOMMENDED_MAX} label="Length" />}>
            {(id) => <Input id={id} name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={effectiveTitle} maxLength={120} />}
          </Field>
          <Field
            label="SEO description"
            name="seoDescription"
            hint={<CharacterCount value={effectiveDescription} min={LENGTHS.DESCRIPTION_RECOMMENDED_MIN} max={LENGTHS.DESCRIPTION_RECOMMENDED_MAX} label="Length" />}
          >
            {(id) => (
              <Textarea id={id} name="seoDescription" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder={excerpt || "Summarise the article for Google"} rows={2} maxLength={320} />
            )}
          </Field>
          <Field label="Main search topic" name="primaryTopic" hint="e.g. “high protein meal prep Malta”. Used for link suggestions — not shown to visitors.">
            {(id) => <Input id={id} name="primaryTopic" defaultValue={post?.primaryTopic ?? ""} maxLength={120} />}
          </Field>
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">Social sharing & advanced</summary>
            <div className="mt-4 space-y-4">
              <Field label="Social title" name="ogTitle">
                {(id) => <Input id={id} name="ogTitle" defaultValue={post?.ogTitle ?? ""} maxLength={120} />}
              </Field>
              <Field label="Social description" name="ogDescription">
                {(id) => <Textarea id={id} name="ogDescription" defaultValue={post?.ogDescription ?? ""} rows={2} maxLength={320} />}
              </Field>
              <MediaPicker name="ogImageId" label="Sharing image" category="SOCIAL" aspect="aspect-[1.91/1]" defaultValue={post?.ogImage ?? null} hint="Defaults to the cover image." />
              <Field label="Canonical URL" name="canonicalUrl" hint="Only if this article was first published elsewhere. Leave empty normally.">
                {(id) => <Input id={id} name="canonicalUrl" defaultValue={post?.canonicalUrl ?? ""} maxLength={500} />}
              </Field>
              <CheckboxField name="noindex" label="Hide this article from Google" defaultChecked={post?.noindex ?? false} />
            </div>
          </details>
        </section>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Publishing</h2>
            <StatusBadge tone={VISIBILITY_TONE[visibility]}>{VISIBILITY_LABEL[visibility]}</StatusBadge>
          </div>
          {post?.publishAtLabel && (
            <p className="text-sm text-muted-foreground">
              {visibility === "SCHEDULED" ? "Goes live" : visibility === "PUBLISHED" ? "Published" : "Last published"}: {post.publishAtLabel}
            </p>
          )}
          {post && <p className="text-xs text-muted-foreground">Content last updated {post.contentUpdatedAtLabel}</p>}
          <div className="space-y-3 rounded-lg bg-muted/50 p-3">
            <div className="flex items-start gap-3">
              <input
                id="needsReview"
                type="checkbox"
                name="needsReview"
                checked={needsReview}
                onChange={(e) => setNeedsReview(e.target.checked)}
                className="mt-0.5 size-4 accent-ink"
              />
              <label htmlFor="needsReview" className="text-sm">
                <span className="font-medium">Needs fact-check</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Untick once the facts, figures and any health or nutrition statements have been checked. Required before publishing.
                </span>
              </label>
            </div>
            <FieldErrorText name="needsReview" />
            <CheckboxField name="isFeatured" label="Feature this article" hint="Shown first on the blog page." defaultChecked={post?.isFeatured ?? false} />
          </div>

          <div className="flex flex-col gap-2">
            {!live && (
              <SubmitButton name="intent" value="publish" disabled={needsReview} className="w-full">
                Publish now
              </SubmitButton>
            )}
            {live && (
              <SubmitButton name="intent" value="publish" className="w-full">
                Update article
              </SubmitButton>
            )}
            {!live && (
              <SubmitButton name="intent" value="draft" variant="outline" className="w-full">
                Save draft
              </SubmitButton>
            )}
            {live && (
              <SubmitButton name="intent" value="unpublish" variant="outline" className="w-full">
                Unpublish
              </SubmitButton>
            )}
            {needsReview && !live && <p className="text-xs text-muted-foreground">Publishing unlocks once “Needs fact-check” is unticked.</p>}
          </div>

          {!live && (
            <details className="rounded-lg border p-3" open={visibility === "SCHEDULED"}>
              <summary className="cursor-pointer text-sm font-medium">Schedule for later</summary>
              <div className="mt-3 space-y-3">
                <DateTimeInput name="publishAtLocal" defaultValue={visibility === "SCHEDULED" ? post?.publishAt : null} />
                <FieldErrorText name="publishAtLocal" />
                <SubmitButton name="intent" value="schedule" variant="secondary" disabled={needsReview} className="w-full">
                  {visibility === "SCHEDULED" ? "Update schedule" : "Schedule"}
                </SubmitButton>
              </div>
            </details>
          )}

          {post && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {live ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/blog/${post.slug}`} target="_blank">
                    <ExternalLink className="size-3.5" /> View live
                  </Link>
                </Button>
              ) : previewUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={previewUrl} target="_blank" rel="noopener">
                    <Eye className="size-3.5" /> Open preview
                  </a>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pendingPreview}
                  onClick={() =>
                    startPreview(async () => {
                      const res = await createPreviewLink(post.id);
                      if (res.ok && res.data) {
                        setPreviewUrl(res.data.url);
                        window.open(res.data.url, "_blank", "noopener");
                      } else toast.error(res.message ?? "Couldn't create a preview link");
                    })
                  }
                >
                  <Eye className="size-3.5" /> Preview
                </Button>
              )}
              <ConfirmAction
                action={deleteBlogPost.bind(null, post.id)}
                title="Delete this article?"
                description={live ? "It will disappear from the website immediately. Consider unpublishing instead." : "This can't be undone."}
                confirmLabel="Delete"
                destructive
                variant="ghost"
                size="sm"
              >
                <Trash2 className="size-3.5" /> Delete
              </ConfirmAction>
            </div>
          )}
          {post && !live && previewUrl && <p className="text-xs text-muted-foreground">Anyone with the preview link can read the draft. It isn&apos;t listed or indexed.</p>}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Link2 className="size-4" />
            <h2 className="text-base font-semibold">Link ideas</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Linking to your own pages helps visitors and Google. Copy an address, select words in the article and click the link button.
            {!post && " Suggestions improve after the first save."}
          </p>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions yet — add a main search topic and some text.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.path} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{s.path}</p>
                  </div>
                  {s.alreadyLinked ? (
                    <StatusBadge tone="good">Linked</StatusBadge>
                  ) : (
                    <CopyButton value={s.path} label={`Copy ${s.path}`} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <FormActions>
        <SubmitButton name="intent" value="save">
          {post ? "Save changes" : "Create draft"}
        </SubmitButton>
        <span className="text-xs text-muted-foreground">Saving keeps the current status ({VISIBILITY_LABEL[visibility].toLowerCase()}).</span>
      </FormActions>
    </AdminForm>
  );
}
