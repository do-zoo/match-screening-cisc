"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Pilcrow,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

export function RichTextEditor({ value, onChange, disabled = false }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value || "<p></p>",
    editable: !disabled,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const handleSetLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background shadow-xs",
        disabled && "opacity-50",
      )}
    >
      <div className="flex flex-wrap gap-0.5 border-b border-input p-1.5">
        <ToolbarButton
          title="Paragraf"
          active={editor?.isActive("paragraph")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Judul 2"
          active={editor?.isActive("heading", { level: 2 })}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Judul 3"
          active={editor?.isActive("heading", { level: 3 })}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Judul 4"
          active={editor?.isActive("heading", { level: 4 })}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 className="h-4 w-4" />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          title="Tebal"
          active={editor?.isActive("bold")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Miring"
          active={editor?.isActive("italic")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Garis bawah"
          active={editor?.isActive("underline")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Coret"
          active={editor?.isActive("strike")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          title="Daftar poin"
          active={editor?.isActive("bulletList")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Daftar bernomor"
          active={editor?.isActive("orderedList")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Kutipan"
          active={editor?.isActive("blockquote")}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          title="Tautan"
          active={editor?.isActive("link")}
          disabled={disabled}
          onClick={handleSetLink}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent
        editor={editor}
        className={cn(
          "[&_.tiptap]:min-h-40 [&_.tiptap]:px-3 [&_.tiptap]:py-2 [&_.tiptap]:text-sm [&_.tiptap]:outline-none",
          "[&_.tiptap_h2]:mb-2 [&_.tiptap_h2]:mt-4 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold",
          "[&_.tiptap_h3]:mb-1 [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold",
          "[&_.tiptap_h4]:mb-1 [&_.tiptap_h4]:mt-2 [&_.tiptap_h4]:font-semibold",
          "[&_.tiptap_p]:mb-2",
          "[&_.tiptap_ul]:mb-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5",
          "[&_.tiptap_ol]:mb-2 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5",
          "[&_.tiptap_li]:mb-0.5",
          "[&_.tiptap_blockquote]:my-2 [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-border [&_.tiptap_blockquote]:pl-4 [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:text-muted-foreground",
          "[&_.tiptap_a]:text-primary [&_.tiptap_a]:underline [&_.tiptap_a]:underline-offset-2",
          "[&_.tiptap_strong]:font-semibold",
        )}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-1 self-stretch w-px bg-border" aria-hidden />;
}
