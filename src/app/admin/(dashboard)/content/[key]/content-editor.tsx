"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { AdminForm, FormActions, SubmitButton, useFormState } from "@/components/admin/form";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ICON_OPTIONS, type ContentFieldDef } from "@/lib/admin/content-fields";
import { saveContentBlock } from "../actions";

type Value = Record<string, unknown>;
type Item = Record<string, string>;

function ErrorText({ path }: { path: string }) {
  const state = useFormState();
  const message = state.fieldErrors?.[path];
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

function Labeled({ label, hint, path, children }: { label: string; hint?: string; path: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <ErrorText path={path} />
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.9;
  return <span className={`text-[0.7rem] tabular ${value.length > max ? "text-destructive" : near ? "text-amber-700" : "text-muted-foreground"}`}>{value.length}/{max}</span>;
}

function ListControls({ index, length, onMove, onRemove, label }: { index: number; length: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-auto text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} {index + 1}
      </span>
      <Button type="button" variant="ghost" size="icon-xs" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" aria-label="Move down" disabled={index === length - 1} onClick={() => onMove(1)}>
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}

function moveIn<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ObjectList({
  field,
  items,
  onChange,
  keys,
  itemLabel,
  maxItems,
  blank,
}: {
  field: string;
  items: Item[];
  onChange: (items: Item[]) => void;
  keys: { key: string; label: string; kind: "input" | "textarea" | "icon"; max?: number; rows?: number }[];
  itemLabel: string;
  maxItems: number;
  blank: Item;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <ListControls
            index={i}
            length={items.length}
            label={itemLabel}
            onMove={(d) => onChange(moveIn(items, i, d))}
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
          />
          {keys.map((k) => {
            const path = `${field}.${i}.${k.key}`;
            const set = (v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [k.key]: v } : it)));
            return (
              <Labeled key={k.key} label={k.label} path={path}>
                {(id) =>
                  k.kind === "icon" ? (
                    <select id={id} value={item[k.key] ?? "flame"} onChange={(e) => set(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                      {ICON_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : k.kind === "textarea" ? (
                    <Textarea id={id} value={item[k.key] ?? ""} rows={k.rows ?? 3} onChange={(e) => set(e.target.value)} />
                  ) : (
                    <Input id={id} value={item[k.key] ?? ""} onChange={(e) => set(e.target.value)} />
                  )
                }
              </Labeled>
            );
          })}
        </div>
      ))}
      <ErrorText path={field} />
      <Button type="button" variant="outline" disabled={items.length >= maxItems} onClick={() => onChange([...items, { ...blank }])}>
        <Plus className="size-4" /> Add {itemLabel.toLowerCase()}
      </Button>
    </div>
  );
}

function FieldRenderer({
  def,
  value,
  set,
  mediaRefs,
}: {
  def: ContentFieldDef;
  value: Value;
  set: (name: string, v: unknown) => void;
  mediaRefs: Record<string, PickedMedia>;
}) {
  const v = value[def.name];
  switch (def.kind) {
    case "text":
      return (
        <Labeled label={def.label} hint={def.hint} path={def.name}>
          {(id) => (
            <div className="space-y-1">
              <Input id={id} value={String(v ?? "")} onChange={(e) => set(def.name, e.target.value)} aria-required={def.required} />
              <div className="text-right">
                <Counter value={String(v ?? "")} max={def.max} />
              </div>
            </div>
          )}
        </Labeled>
      );
    case "textarea":
      return (
        <Labeled label={def.label} hint={def.hint} path={def.name}>
          {(id) => (
            <div className="space-y-1">
              <Textarea id={id} value={String(v ?? "")} rows={def.rows ?? 3} onChange={(e) => set(def.name, e.target.value)} />
              <div className="text-right">
                <Counter value={String(v ?? "")} max={def.max} />
              </div>
            </div>
          )}
        </Labeled>
      );
    case "cta": {
      const cta = (v as { label?: string; href?: string } | undefined) ?? {};
      return (
        <fieldset className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{def.label}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Button text" path={`${def.name}.label`}>
              {(id) => <Input id={id} value={cta.label ?? ""} onChange={(e) => set(def.name, { ...cta, label: e.target.value })} />}
            </Labeled>
            <Labeled label="Link" path={`${def.name}.href`} hint="A page on this site like /plans, or a full https:// link.">
              {(id) => <Input id={id} value={cta.href ?? ""} onChange={(e) => set(def.name, { ...cta, href: e.target.value })} />}
            </Labeled>
          </div>
        </fieldset>
      );
    }
    case "media":
      return (
        <div className="space-y-1.5">
          <MediaPicker
            name={`__media_${def.name}`}
            label={def.label}
            category={def.category}
            defaultValue={typeof v === "string" ? (mediaRefs[v] ?? null) : null}
            onChange={(m) => set(def.name, m?.id ?? null)}
            hint={def.hint ?? "Optional. Without a photo, tasteful placeholder artwork is shown."}
          />
          <ErrorText path={def.name} />
        </div>
      );
    case "boolean": {
      return (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(def.name, e.target.checked)} className="mt-0.5 size-4 accent-ink" />
          <span>
            <span className="font-medium">{def.label}</span>
            {def.hint && <span className="block text-xs text-muted-foreground">{def.hint}</span>}
          </span>
        </label>
      );
    }
    case "number":
      return (
        <Labeled label={def.label} hint={def.hint ?? `${def.min}–${def.max}`} path={def.name}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min={def.min}
              max={def.max}
              value={String(v ?? def.min)}
              onChange={(e) => set(def.name, e.target.value === "" ? "" : Number(e.target.value))}
              className="max-w-28"
            />
          )}
        </Labeled>
      );
    case "strings": {
      const list = Array.isArray(v) ? (v as string[]) : [];
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{def.label}</legend>
          {list.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <Input value={s} aria-label={`${def.itemLabel} ${i + 1}`} onChange={(e) => set(def.name, list.map((x, j) => (j === i ? e.target.value : x)))} />
                <ErrorText path={`${def.name}.${i}`} />
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => set(def.name, moveIn(list, i, -1))}>
                <ArrowUp className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => set(def.name, list.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <ErrorText path={def.name} />
          <Button type="button" variant="outline" disabled={list.length >= def.maxItems} onClick={() => set(def.name, [...list, ""])}>
            <Plus className="size-4" /> Add {def.itemLabel.toLowerCase()}
          </Button>
        </fieldset>
      );
    }
    case "items":
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{def.label}</legend>
          <ObjectList
            field={def.name}
            items={(Array.isArray(v) ? v : []) as Item[]}
            onChange={(items) => set(def.name, items)}
            itemLabel={def.itemLabel}
            maxItems={def.maxItems}
            blank={def.withIcon ? { title: "", body: "", icon: "flame" } : { title: "", body: "" }}
            keys={[
              ...(def.withIcon ? [{ key: "icon", label: "Icon", kind: "icon" as const }] : []),
              { key: "title", label: "Title", kind: "input" as const },
              { key: "body", label: "Text", kind: "textarea" as const, rows: 2 },
            ]}
          />
        </fieldset>
      );
    case "faqs":
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{def.label}</legend>
          <ObjectList
            field={def.name}
            items={(Array.isArray(v) ? v : []) as Item[]}
            onChange={(items) => set(def.name, items)}
            itemLabel="Question"
            maxItems={def.maxItems}
            blank={{ question: "", answer: "" }}
            keys={[
              { key: "question", label: "Question", kind: "input" },
              { key: "answer", label: "Answer", kind: "textarea", rows: 3 },
            ]}
          />
        </fieldset>
      );
    case "sections":
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{def.label}</legend>
          {def.hint && <p className="text-xs text-muted-foreground">{def.hint} Leave a blank line between paragraphs.</p>}
          <ObjectList
            field={def.name}
            items={(Array.isArray(v) ? v : []) as Item[]}
            onChange={(items) => set(def.name, items)}
            itemLabel="Section"
            maxItems={def.maxItems}
            blank={{ heading: "", body: "" }}
            keys={[
              { key: "heading", label: "Sub-heading", kind: "input" },
              { key: "body", label: "Text", kind: "textarea", rows: 5 },
            ]}
          />
        </fieldset>
      );
    case "html":
      return (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{def.label}</p>
          {def.hint && <p className="text-xs text-muted-foreground">{def.hint}</p>}
          <RichTextEditor name={`__html_${def.name}`} defaultValue={String(v ?? "")} onChange={(html) => set(def.name, html)} minHeight={420} />
          <ErrorText path={def.name} />
        </div>
      );
  }
}

export function ContentEditor({
  contentKey,
  fields,
  initial,
  mediaRefs,
}: {
  contentKey: string;
  fields: ContentFieldDef[];
  initial: Value;
  mediaRefs: Record<string, PickedMedia>;
}) {
  const [value, setValue] = useState<Value>(initial);
  const set = (name: string, v: unknown) => setValue((prev) => ({ ...prev, [name]: v }));
  return (
    <AdminForm action={saveContentBlock.bind(null, contentKey)} className="space-y-6">
      <input type="hidden" name="data" value={JSON.stringify(value)} />
      <div className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
        {fields.map((f) => (
          <FieldRenderer key={f.name} def={f} value={value} set={set} mediaRefs={mediaRefs} />
        ))}
      </div>
      <FormActions>
        <SubmitButton>Save changes</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
