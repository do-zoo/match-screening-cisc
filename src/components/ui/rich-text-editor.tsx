'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
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
  ImageIcon,
  Undo2,
  Redo2,
  Minus,
} from 'lucide-react'

import { uploadEventDescriptionImage } from '@/lib/actions/upload-event-description-image'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type RichTextEditorImageUpload = {
  eventId: string
  assetToken: string
}

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  descriptionImageUpload?: RichTextEditorImageUpload | null
}

const PLACEHOLDER = 'Tulis deskripsi untuk halaman publik…'

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  descriptionImageUpload = null,
}: RichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
      }),
      Underline,
      Placeholder.configure({ placeholder: PLACEHOLDER }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ],
    [],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value || '<p></p>',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imgPending, startImgTransition] = useTransition()

  const handleImagePick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !editor || !descriptionImageUpload) return

      startImgTransition(async () => {
        const fd = new FormData()
        fd.set('file', file)
        fd.set('token', descriptionImageUpload.assetToken)
        const res = await uploadEventDescriptionImage(descriptionImageUpload.eventId, undefined, fd)
        if (!res.ok) {
          toastActionErr(res)
          return
        }
        editor.chain().focus().setImage({ src: res.data.url, alt: '' }).run()
        toastCudSuccess('update', 'Gambar berhasil disisipkan.')
      })
    },
    [descriptionImageUpload, editor],
  )

  return (
    <div className={cn('rounded-md border border-input bg-background shadow-xs', disabled && 'opacity-50')}>
      <input
        ref={fileInputRef}
        type='file'
        className='sr-only'
        accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
        aria-hidden
        tabIndex={-1}
        onChange={handleImageFile}
      />
      <div className='flex flex-wrap gap-0.5 border-b border-input p-1.5'>
        <ToolbarButton
          title='Paragraf'
          active={editor?.isActive('paragraph')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          <Pilcrow className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Judul 2'
          active={editor?.isActive('heading', { level: 2 })}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Judul 3'
          active={editor?.isActive('heading', { level: 3 })}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Judul 4'
          active={editor?.isActive('heading', { level: 4 })}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 className='h-4 w-4' />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          title='Tebal'
          active={editor?.isActive('bold')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Miring'
          active={editor?.isActive('italic')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Garis bawah'
          active={editor?.isActive('underline')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Coret'
          active={editor?.isActive('strike')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className='h-4 w-4' />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          title='Daftar poin'
          active={editor?.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Daftar bernomor'
          active={editor?.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Kutipan'
          active={editor?.isActive('blockquote')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className='h-4 w-4' />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          title='Pemisah horizontal'
          active={false}
          disabled={disabled}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className='h-4 w-4' />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          title='Urungkan'
          active={false}
          disabled={disabled || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Ulangi'
          active={false}
          disabled={disabled || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className='h-4 w-4' />
        </ToolbarButton>

        <Separator />

        <LinkPopoverButton editor={editor} disabled={disabled} />

        {descriptionImageUpload ? (
          <ToolbarButton
            title='Sisipkan gambar'
            active={false}
            disabled={disabled || imgPending}
            onClick={handleImagePick}
          >
            <ImageIcon className='h-4 w-4' />
          </ToolbarButton>
        ) : null}
      </div>

      <EditorContent
        editor={editor}
        className={cn(
          '[&_.tiptap]:min-h-40 [&_.tiptap]:px-3 [&_.tiptap]:py-2 [&_.tiptap]:text-sm [&_.tiptap]:outline-none',
          '[&_.tiptap_p.is-editor-empty::before]:pointer-events-none [&_.tiptap_p.is-editor-empty::before]:float-left [&_.tiptap_p.is-editor-empty::before]:h-0 [&_.tiptap_p.is-editor-empty::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty::before]:content-[attr(data-placeholder)]',
          '[&_.tiptap_h2]:mb-2 [&_.tiptap_h2]:mt-4 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold',
          '[&_.tiptap_h3]:mb-1 [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold',
          '[&_.tiptap_h4]:mb-1 [&_.tiptap_h4]:mt-2 [&_.tiptap_h4]:font-semibold',
          '[&_.tiptap_p]:mb-2',
          '[&_.tiptap_ul]:mb-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5',
          '[&_.tiptap_ol]:mb-2 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5',
          '[&_.tiptap_li]:mb-0.5',
          '[&_.tiptap_blockquote]:my-2 [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-border [&_.tiptap_blockquote]:pl-4 [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:text-muted-foreground',
          '[&_.tiptap_a]:text-primary [&_.tiptap_a]:underline [&_.tiptap_a]:underline-offset-2',
          '[&_.tiptap_strong]:font-semibold',
          '[&_.tiptap_img]:my-2 [&_.tiptap_img]:max-h-96 [&_.tiptap_img]:w-full [&_.tiptap_img]:max-w-full [&_.tiptap_img]:rounded-md [&_.tiptap_img]:object-contain',
          '[&_.tiptap_hr]:my-4 [&_.tiptap_hr]:border-border',
        )}
      />
    </div>
  )
}

function LinkPopoverButton({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && editor) {
        const href = editor.getAttributes('link').href as string | undefined
        setUrl(href ?? '')
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
    [editor],
  )

  const apply = useCallback(() => {
    if (!editor) return
    const trimmed = url.trim()
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      const withScheme = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('mailto:') ? trimmed : `https://${trimmed}`
      editor.chain().focus().extendMarkRange('link').setLink({ href: withScheme, target: '_blank' }).run()
    }
    handleOpenChange(false)
  }, [editor, url, handleOpenChange])

  const removeLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setUrl('')
    handleOpenChange(false)
  }, [editor, handleOpenChange])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        title='Tautan'
        aria-label='Tautan'
        className={cn(
          'rounded p-1.5 transition-colors',
          editor?.isActive('link')
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          disabled && 'pointer-events-none opacity-50',
        )}
        render={<button type='button' />}
      >
        <LinkIcon className='h-4 w-4' />
      </PopoverTrigger>
      <PopoverContent className='w-80' align='start'>
        <PopoverHeader>
          <PopoverTitle>Tautan</PopoverTitle>
          <PopoverDescription>Tempel URL lengkap (https://…) atau alamat surel.</PopoverDescription>
        </PopoverHeader>
        <div className='flex flex-col gap-2'>
          <Input
            ref={inputRef}
            type='url'
            inputMode='url'
            placeholder='https://'
            value={url}
            disabled={disabled}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply()
              }
            }}
          />
          <div className='flex flex-wrap gap-2'>
            <Button type='button' size='sm' onClick={apply} disabled={disabled}>
              Terapkan
            </Button>
            <Button type='button' size='sm' variant='outline' onClick={removeLink} disabled={disabled}>
              Hapus tautan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type='button'
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <div className='mx-1 self-stretch w-px bg-border' aria-hidden />
}
