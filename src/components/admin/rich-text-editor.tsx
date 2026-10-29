"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaLibraryDialog } from "./media-picker";

function ToolbarButton({
  onClick,
  active,
  label,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-grid size-8 place-items-center rounded text-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-ink text-white hover:bg-ink hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (e.g. /menu or https://…)", previous ?? "");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = url.trim();
    if (!/^(\/|https?:\/\/|mailto:|tel:)/i.test(href)) {
      window.alert("Links must start with /, https://, mailto: or tel:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
      <ToolbarButton label="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Subheading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Add link" active={state.link} onClick={setLink}>
        <Link2 className="size-4" />
      </ToolbarButton>
      {state.link && (
        <ToolbarButton label="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Link2Off className="size-4" />
        </ToolbarButton>
      )}
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton label="Bullet list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Insert image" onClick={onImage}>
        <ImagePlus className="size-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

/**
 * Rich-text editor (headings, lists, links, images). Posts sanitised-on-save
 * HTML through a hidden input called `name`.
 */
export function RichTextEditor({
  name,
  defaultValue = "",
  placeholder = "Start writing…",
  minHeight = 320,
  onChange,
  imageCategory = "BLOG",
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  minHeight?: number;
  onChange?: (html: string) => void;
  imageCategory?: string;
}) {
  const [html, setHtml] = useState(defaultValue);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      ImageExtension.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class: "prose-brand max-w-none px-4 py-3 outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: e }) => {
      const value = e.isEmpty ? "" : e.getHTML();
      setHtml(value);
      onChange?.(value);
    },
  });

  return (
    <div className="overflow-hidden rounded-md border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
      <input type="hidden" name={name} value={html} />
      {editor ? (
        <>
          <Toolbar editor={editor} onImage={() => setPickerOpen(true)} />
          <EditorContent editor={editor} />
          <MediaLibraryDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            category={imageCategory}
            title="Insert an image"
            onSelect={(m) => editor.chain().focus().setImage({ src: m.url, alt: m.altText ?? "" }).run()}
          />
        </>
      ) : (
        <div className="px-4 py-3 text-sm text-muted-foreground" style={{ minHeight }}>
          Loading editor…
        </div>
      )}
    </div>
  );
}
