'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Braces,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Code,
} from 'lucide-react'

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
import type { WaTemplateCatalogEntry } from '@/lib/wa-templates/wa-template-catalog'
import { allowedTokensForKey } from '@/lib/wa-templates/wa-template-catalog'
import { docToWaMarkdown, waMarkdownToDoc } from '@/lib/wa-templates/wa-markdown-serializer'
import { analyzeWaTemplateMarkdown } from '@/lib/wa-templates/wa-template-editor-validation'
import { WaPlaceholder } from '@/lib/wa-templates/wa-placeholder-extension'
import type { WaTemplateKey } from '@prisma/client'

export type WaTemplateEditorProps = {
  templateKey: WaTemplateKey
  catalogEntry: WaTemplateCatalogEntry
  value: string
  onChange: (markdown: string) => void
  disabled?: boolean
  onValidationChange?: (state: { missingRequired: string[]; invalidTokens: string[] }) => void
  onEditorReady?: (editor: Editor | null) => void
}

const EDITOR_PLACEHOLDER = 'Tulis pesan WhatsApp…'

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

function Separator() {
  return <div className='bg-border mx-0.5 h-6 w-px shrink-0' aria-hidden />
}

function getOpenBraceSuggest(editor: Editor): { from: number; query: string } | null {
  const { from } = editor.state.selection
  const $from = editor.state.doc.resolve(from)
  const textBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 80),
    $from.parentOffset,
    undefined,
    '\ufffc',
  )
  const match = textBefore.match(/\{([a-z0-9_]*)$/)
  if (!match) return null
  const query = match[1] ?? ''
  const braceFrom = from - query.length - 1
  return { from: braceFrom, query }
}

export function WaTemplateEditor({
  templateKey,
  catalogEntry,
  value,
  onChange,
  disabled = false,
  onValidationChange,
  onEditorReady,
}: WaTemplateEditorProps) {
  const allowedTokens = useMemo(
    () => new Set(allowedTokensForKey(templateKey)),
    [templateKey],
  )
  const requiredTokens = useMemo(() => new Set(catalogEntry.requiredTokens), [catalogEntry.requiredTokens])

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        link: false,
        underline: false,
        horizontalRule: false,
        blockquote: {},
        bulletList: {},
        orderedList: {},
        strike: {},
      }),
      Placeholder.configure({ placeholder: EDITOR_PLACEHOLDER }),
      WaPlaceholder.configure({
        allowedTokens,
        requiredTokens,
        tokenMeta: catalogEntry.tokenMeta,
      }),
    ],
    [allowedTokens, requiredTokens, catalogEntry.tokenMeta],
  )

  const onValidationChangeRef = useRef(onValidationChange)

  useEffect(() => {
    onValidationChangeRef.current = onValidationChange
  }, [onValidationChange])

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: waMarkdownToDoc(value, catalogEntry),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'tiptap wa-template-tiptap min-h-[220px] px-3 py-2 focus:outline-none',
      },
    },
    onUpdate({ editor: ed }) {
      const md = docToWaMarkdown(ed.getJSON())
      onChange(md)
      onValidationChangeRef.current?.(analyzeWaTemplateMarkdown(md, catalogEntry))
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const current = docToWaMarkdown(editor.getJSON())
    if (current !== value) {
      editor.commands.setContent(waMarkdownToDoc(value, catalogEntry), { emitUpdate: false })
      onValidationChangeRef.current?.(analyzeWaTemplateMarkdown(value, catalogEntry))
    }
  }, [editor, value, catalogEntry])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    onEditorReady?.(editor)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  const insertToken = useCallback(
    (token: string) => {
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: 'waPlaceholder',
          attrs: { token, invalid: !allowedTokens.has(token) },
        })
        .run()
    },
    [editor, allowedTokens],
  )

  const [varSearch, setVarSearch] = useState('')
  const [suggest, setSuggest] = useState<{ from: number; query: string } | null>(null)

  useEffect(() => {
    if (!editor) return
    const refresh = () => setSuggest(getOpenBraceSuggest(editor))
    editor.on('selectionUpdate', refresh)
    editor.on('update', refresh)
    return () => {
      editor.off('selectionUpdate', refresh)
      editor.off('update', refresh)
    }
  }, [editor])

  const suggestionTokens = useMemo(() => {
    if (!suggest) return []
    const q = suggest.query.toLowerCase()
    return [...allowedTokens].filter(t => t.includes(q) || catalogEntry.tokenMeta[t]?.labelId.toLowerCase().includes(q))
  }, [suggest, allowedTokens, catalogEntry.tokenMeta])

  const applySuggestion = useCallback(
    (token: string) => {
      if (!editor || !suggest) return
      const to = editor.state.selection.from
      editor
        .chain()
        .focus()
        .deleteRange({ from: suggest.from, to })
        .insertContent({
          type: 'waPlaceholder',
          attrs: { token, invalid: !allowedTokens.has(token) },
        })
        .run()
      setSuggest(null)
    },
    [editor, suggest, allowedTokens],
  )

  const requiredList = catalogEntry.requiredTokens
  const optionalList = catalogEntry.optionalTokens

  const filteredRequired = requiredList.filter(t => {
    const q = varSearch.trim().toLowerCase()
    if (!q) return true
    const label = catalogEntry.tokenMeta[t]?.labelId ?? t
    return t.includes(q) || label.toLowerCase().includes(q)
  })
  const filteredOptional = optionalList.filter(t => {
    const q = varSearch.trim().toLowerCase()
    if (!q) return true
    const label = catalogEntry.tokenMeta[t]?.labelId ?? t
    return t.includes(q) || label.toLowerCase().includes(q)
  })

  return (
    <div className={cn('rounded-md border border-input bg-background shadow-xs', disabled && 'opacity-50')}>
      <div className='flex flex-wrap gap-0.5 border-b border-input p-1.5'>
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
          title='Coret'
          active={editor?.isActive('strike')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Kode'
          active={editor?.isActive('code')}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Code className='h-4 w-4' />
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
          title='Urungkan'
          disabled={disabled || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className='h-4 w-4' />
        </ToolbarButton>
        <ToolbarButton
          title='Ulangi'
          disabled={disabled || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className='h-4 w-4' />
        </ToolbarButton>

        <Separator />

        <Popover>
          <PopoverTrigger render={<Button type='button' variant='outline' size='sm' disabled={disabled} />}>
            <Braces className='mr-1.5 h-4 w-4' />
            Sisipkan variabel
          </PopoverTrigger>
          <PopoverContent className='w-80 p-0' align='start'>
            <PopoverHeader className='border-b px-3 py-2'>
              <PopoverTitle>Variabel</PopoverTitle>
              <PopoverDescription>Pilih placeholder untuk disisipkan di kursor.</PopoverDescription>
            </PopoverHeader>
            <div className='p-2'>
              <Input
                placeholder='Cari variabel…'
                value={varSearch}
                onChange={e => setVarSearch(e.target.value)}
                className='h-8 text-sm'
              />
            </div>
            <div className='max-h-64 overflow-y-auto px-2 pb-2'>
              {filteredRequired.length > 0 ? (
                <div className='mb-2'>
                  <p className='text-muted-foreground mb-1 px-1 text-xs font-medium'>Wajib</p>
                  <ul className='flex flex-col gap-0.5'>
                    {filteredRequired.map(token => (
                      <li key={token}>
                        <button
                          type='button'
                          className='hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm'
                          onClick={() => insertToken(token)}
                        >
                          <span className='font-medium'>{catalogEntry.tokenMeta[token]?.labelId ?? token}</span>
                          <span className='text-muted-foreground ml-2 font-mono text-xs'>{`{${token}}`}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {filteredOptional.length > 0 ? (
                <div>
                  <p className='text-muted-foreground mb-1 px-1 text-xs font-medium'>Opsional</p>
                  <ul className='flex flex-col gap-0.5'>
                    {filteredOptional.map(token => (
                      <li key={token}>
                        <button
                          type='button'
                          className='hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm'
                          onClick={() => insertToken(token)}
                        >
                          <span className='font-medium'>{catalogEntry.tokenMeta[token]?.labelId ?? token}</span>
                          <span className='text-muted-foreground ml-2 font-mono text-xs'>{`{${token}}`}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {filteredRequired.length === 0 && filteredOptional.length === 0 ? (
                <p className='text-muted-foreground px-2 py-4 text-center text-sm'>Tidak ada variabel cocok.</p>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className='relative'>
        <EditorContent editor={editor} />
        {suggest && suggestionTokens.length > 0 ? (
          <div
            className='border-input bg-popover absolute top-2 left-2 z-10 max-h-40 w-64 overflow-y-auto rounded-md border shadow-md'
          >
            {suggestionTokens.map(token => (
              <button
                key={token}
                type='button'
                className='hover:bg-muted w-full px-2 py-1.5 text-left text-sm'
                onMouseDown={e => {
                  e.preventDefault()
                  applySuggestion(token)
                }}
              >
                <span className='font-medium'>{catalogEntry.tokenMeta[token]?.labelId ?? token}</span>
                <span className='text-muted-foreground ml-2 font-mono text-xs'>{`{${token}}`}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
