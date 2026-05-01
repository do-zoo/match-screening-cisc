# WYSIWYG Event Description Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain `<textarea>` on the admin event create/edit form's description field with a WYSIWYG rich-text editor (Tiptap), matching the HTML tags the server's sanitizer already allows.

**Architecture:** Add Tiptap (`@tiptap/react`) as a `"use client"` component at `src/components/ui/rich-text-editor.tsx`. Wire it into `EventAdminForm` via `react-hook-form`'s `Controller`. No changes are needed to server actions, Prisma schema, or the sanitizer — the server already expects arbitrary HTML and sanitizes it.

**Tech Stack:** Tiptap 2.x (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-link`), React 19, Tailwind v4, lucide-react (already installed), react-hook-form `Controller` (already used in the form).

---

## Allowed HTML tags (from `src/lib/public/sanitize-event-description.ts`)

The sanitizer strips anything outside: `p br strong b em i u s ul ol li a h2 h3 h4 blockquote div span`. Toolbar buttons are limited to exactly these.

---

## File Map

| Action | File |
|--------|------|
| **Create** | `src/components/ui/rich-text-editor.tsx` |
| **Modify** | `src/components/admin/forms/event-admin-form.tsx` lines 208–217 |

---

### Task 1: Install Tiptap packages

**Files:**
- No files created — only `package.json` / `pnpm-lock.yaml` change.

- [ ] **Step 1: Install**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link
```

Expected: `Packages: +N added (N packages)` with no errors.

- [ ] **Step 2: Verify packages installed**

```bash
node -e "require('@tiptap/react'); require('@tiptap/starter-kit'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install tiptap for wysiwyg event description"
```

---

### Task 2: Create `RichTextEditor` component

**Files:**
- Create: `src/components/ui/rich-text-editor.tsx`

- [ ] **Step 1: Create the file**

Create `src/components/ui/rich-text-editor.tsx` with the full content below.

```tsx
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

  // Sync external value changes (e.g., form reset from parent)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "<p></p>", false);
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
      {/* Toolbar */}
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

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className={cn(
          "[&_.tiptap]:min-h-[10rem] [&_.tiptap]:px-3 [&_.tiptap]:py-2 [&_.tiptap]:text-sm [&_.tiptap]:outline-none",
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm exec tsc --noEmit --project tsconfig.json 2>&1 | head -40
```

Expected: No errors about `rich-text-editor.tsx`. If you see `Cannot find module '@tiptap/react'`, re-run Task 1.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/rich-text-editor.tsx
git commit -m "feat(ui): add RichTextEditor component (Tiptap)"
```

---

### Task 3: Wire `RichTextEditor` into `EventAdminForm`

**Files:**
- Modify: `src/components/admin/forms/event-admin-form.tsx`

**Context:** The form already imports `Controller` from `react-hook-form` (line 10) and uses it elsewhere (e.g., `registrationCapacity` at line 251). The textarea for `descriptionHtml` is at lines 208–217.

- [ ] **Step 1: Add import**

In `src/components/admin/forms/event-admin-form.tsx`, add the import directly after the existing `import { cn } from "@/lib/utils";` line (line 40):

```tsx
import { RichTextEditor } from "@/components/ui/rich-text-editor";
```

- [ ] **Step 2: Replace the textarea**

Find this block (lines 208–217):

```tsx
          <Field label="Deskripsi (HTML)">
            <textarea
              {...form.register("descriptionHtml")}
              rows={8}
              disabled={pending}
              className={cn(
                "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]",
              )}
            />
          </Field>
```

Replace it with:

```tsx
          <Field label="Deskripsi">
            <Controller
              control={form.control}
              name="descriptionHtml"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                />
              )}
            />
          </Field>
```

- [ ] **Step 3: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 4: Run lint**

```bash
pnpm lint 2>&1 | tail -20
```

Expected: No errors (warnings OK).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx
git commit -m "feat(admin): replace description textarea with WYSIWYG editor"
```

---

### Task 4: Build & manual verification

**Files:** No changes — verification only.

- [ ] **Step 1: Full build**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm build 2>&1 | tail -30
```

Expected: `Route (app)` summary table with no build errors.

- [ ] **Step 2: Start dev server and verify manually**

```bash
pnpm dev
```

Open `http://localhost:3000/admin/events/new` in a browser.

Verify:
1. The description field shows a toolbar (H2 H3 H4 | Bold Italic Underline Strike | List OrderedList Quote | Link) and a blank editable area below it.
2. Clicking **Bold** and typing text renders `<strong>` output.
3. Clicking **Tautan (Link)** prompts for a URL and wraps selection in an `<a>` tag.
4. Opening an **existing event edit page** (`/admin/events/[eventId]/edit`) pre-fills the editor with the saved HTML correctly.
5. Saving the form stores the HTML correctly — check the event edit page reloads with the content.
6. While the form is submitting (the "Menyimpan…" state), all toolbar buttons are visually disabled (greyed out).

- [ ] **Step 3: Done — no further commit needed unless a bug was found above**
