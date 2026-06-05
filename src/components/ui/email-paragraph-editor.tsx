'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react'
import type { JSONContent } from '@tiptap/core'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { EmailTemplateCatalogEntry } from '@/lib/email-templates/email-template-catalog'
import { allowedTokensForKey } from '@/lib/email-templates/email-template-catalog'
import { EmailPlaceholder } from '@/lib/email-templates/email-placeholder-extension'
import type { EmailTemplateKey } from '@prisma/client'

export type EmailParagraphEditorProps = {
  templateKey: EmailTemplateKey
  catalogEntry: EmailTemplateCatalogEntry
  value: JSONContent
  onChange: (doc: JSONContent) => void
  disabled?: boolean
  onEditorReady?: (editor: Editor | null) => void
}

function ToolbarButton(props: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type='button'
      variant={props.active ? 'secondary' : 'ghost'}
      size='icon-sm'
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
      className='shrink-0'
    >
      {props.children}
    </Button>
  )
}

export function EmailParagraphEditor({
  templateKey,
  catalogEntry,
  value,
  onChange,
  disabled = false,
  onEditorReady,
}: EmailParagraphEditorProps) {
  const allowedTokens = useMemo(() => new Set(allowedTokensForKey(templateKey)), [templateKey])
  const requiredTokens = useMemo(() => new Set(catalogEntry.requiredTokens), [catalogEntry.requiredTokens])

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: {},
        horizontalRule: false,
        strike: false,
        link: false,
        underline: false,
        bulletList: {},
        orderedList: {},
      }),
      TextAlign.configure({
        types: ['paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        validate: href => href.startsWith('https://') || href.startsWith('mailto:'),
      }),
      Placeholder.configure({ placeholder: 'Tulis paragraf email…' }),
      EmailPlaceholder.configure({
        allowedTokens,
        requiredTokens,
        tokenMeta: catalogEntry.tokenMeta,
      }),
    ],
    [allowedTokens, requiredTokens, catalogEntry.tokenMeta],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'tiptap email-template-tiptap min-h-[140px] px-3 py-2 focus:outline-none',
      },
    },
    onUpdate({ editor: ed }) {
      onChange(ed.getJSON())
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const current = JSON.stringify(editor.getJSON())
    const incoming = JSON.stringify(value)
    if (current !== incoming) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const handleFocus = () => onEditorReady?.(editor)
    editor.on('focus', handleFocus)
    return () => {
      editor.off('focus', handleFocus)
    }
  }, [editor, onEditorReady])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('URL (https:// atau mailto:)', prev ?? 'https://')
    if (href === null) return
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    if (!href.startsWith('https://') && !href.startsWith('mailto:')) return
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }, [editor])

  if (!editor) return null

  const tokenList = allowedTokensForKey(templateKey)

  return (
    <div className='border-input bg-background overflow-hidden rounded-lg border'>
      <div className='border-border bg-muted/20 flex flex-wrap items-center gap-0.5 border-b px-1 py-1'>
        <ToolbarButton
          title='Tebal'
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className='size-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Miring'
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className='size-4' />
        </ToolbarButton>
        <ToolbarButton title='Tautan' active={editor.isActive('link')} disabled={disabled} onClick={setLink}>
          <Link2 className='size-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Daftar bullet'
          active={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className='size-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Daftar nomor'
          active={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className='size-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Kutipan'
          active={editor.isActive('blockquote')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className='size-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Rata kiri'
          active={
            editor.isActive({ textAlign: 'left' }) ||
            (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }))
          }
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className='size-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Rata tengah'
          active={editor.isActive({ textAlign: 'center' })}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className='size-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Rata kanan'
          active={editor.isActive({ textAlign: 'right' })}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className='size-4' />
        </ToolbarButton>
        <Popover>
          <PopoverTrigger
            render={
              <Button type='button' variant='ghost' size='icon-sm' title='Sisip variabel' disabled={disabled} />
            }
          >
            <Braces className='size-4' />
          </PopoverTrigger>
          <PopoverContent align='start' className='w-64'>
            <PopoverHeader>
              <PopoverTitle>Variabel</PopoverTitle>
            </PopoverHeader>
            <ul className='max-h-48 space-y-1 overflow-y-auto text-sm'>
              {tokenList.map(token => (
                <li key={token}>
                  <button
                    type='button'
                    className='hover:bg-muted w-full rounded-md px-2 py-1.5 text-left'
                    onClick={() => editor.chain().focus().insertEmailPlaceholder(token).run()}
                  >
                    <span className='font-medium'>{catalogEntry.tokenMeta[token]?.labelId ?? token}</span>
                    <span className='text-muted-foreground block font-mono text-xs'>{`{${token}}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        <ToolbarButton title='Urungkan' disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className='size-4' />
        </ToolbarButton>
        <ToolbarButton title='Ulangi' disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className='size-4' />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
