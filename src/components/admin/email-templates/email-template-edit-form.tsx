'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Editor } from '@tiptap/react'
import type { EmailTemplateKey } from '@prisma/client'
import { ChevronDown, ChevronUp, GripVertical, Lock, Plus, X } from 'lucide-react'

import { EmailParagraphEditor } from '@/components/ui/email-paragraph-editor'
import { EmailTemplatePreviewPanel } from '@/components/admin/email-templates/email-template-preview-panel'
import { EmailTemplateSaveActions } from '@/components/admin/email-templates/email-template-save-actions'
import { EmailTemplateVariableSidebar } from '@/components/admin/email-templates/email-template-sidebar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  previewClubEmailTemplate,
  resetClubEmailTemplate,
  saveClubEmailTemplate,
} from '@/lib/actions/admin-club-email-templates'
import { toastCudSuccess } from '@/lib/client/cud-notify'
import type { ActionResult } from '@/lib/forms/action-result'
import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import type { EmailTemplateCatalogEntry } from '@/lib/email-templates/email-template-catalog'
import { allowedTokensForKey } from '@/lib/email-templates/email-template-catalog'
import {
  addParagraphBlock,
  moveEmailBlock,
  reorderEmailBlocks,
  removeParagraphBlock,
  updateBlockField,
  updateParagraphDoc,
} from '@/lib/email-templates/email-block-list-utils'
import { analyzeEmailTemplateBlocks } from '@/lib/email-templates/email-template-editor-validation'
import { serializeStoredBody } from '@/lib/email-templates/parse-stored-email-body'

const SYSTEM_BLOCK_LABELS: Record<string, string> = {
  invoice_summary: 'Ringkasan tagihan',
  registration_receipt: 'Bukti pendaftaran',
  bank_details: 'Detail rekening',
  cta_button: 'Tombol CTA',
  footer_disclaimer: 'Footer',
}

const SYSTEM_BLOCK_HINTS: Record<string, string> = {
  invoice_summary: 'Ringkasan nominal diisi otomatis saat email dikirim.',
  registration_receipt:
    'Nomor pemesanan, total terverifikasi, dan detail acara diisi otomatis — ini bukti resmi pembayaran.',
  bank_details: 'Detail rekening diisi otomatis dari data acara.',
  cta_button: 'Anda dapat mengubah label tombol di bawah.',
  footer_disclaimer: 'Teks disclaimer tampil di bagian bawah email.',
}

export function EmailTemplateEditForm(props: {
  templateKey: EmailTemplateKey
  catalogEntry: EmailTemplateCatalogEntry
  displaySubject: string
  displayBlocks: EmailBlock[]
  isCustomized: boolean
}) {
  const router = useRouter()
  const { templateKey, catalogEntry, isCustomized } = props
  const [subject, setSubject] = useState(props.displaySubject)
  const [blocks, setBlocks] = useState(props.displayBlocks)
  const [focusedEditor, setFocusedEditor] = useState<Editor | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [dropOverBlockId, setDropOverBlockId] = useState<string | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()

  const bodyJson = useMemo(() => serializeStoredBody({ v: 1, blocks }), [blocks])
  const validation = useMemo(
    () => analyzeEmailTemplateBlocks(templateKey, subject, blocks),
    [templateKey, subject, blocks],
  )

  const initialState = null as ActionResult<{ saved: true }> | null
  const [saveState, saveDispatch, savePending] = useActionState(saveClubEmailTemplate, initialState)
  const [resetState, resetDispatch, resetPending] = useActionState(resetClubEmailTemplate, initialState)

  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (saveState?.ok) toastCudSuccess('update', 'Template email disimpan.')
  }, [saveState])

  useEffect(() => {
    if (resetState?.ok) {
      toastCudSuccess('update', 'Template email dikembalikan ke bawaan.')
      router.refresh()
    }
  }, [resetState, router])

  const refreshPreview = useCallback(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    previewDebounceRef.current = setTimeout(() => {
      startPreviewTransition(async () => {
        const res = await previewClubEmailTemplate({ key: templateKey, subject, body: bodyJson })
        if (res.ok) setPreviewHtml(res.data.html)
        else setPreviewHtml(null)
      })
    }, 300)
  }, [templateKey, subject, bodyJson])

  useEffect(() => {
    refreshPreview()
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    }
  }, [refreshPreview])

  const canSave =
    validation.missingRequired.length === 0 &&
    validation.invalidTokens.length === 0 &&
    subject.trim().length > 0 &&
    blocks.some(b => b.type === 'paragraph')

  const combinedPending = savePending || resetPending

  const systemOnlyTokens = allowedTokensForKey(templateKey).filter(
    t => !catalogEntry.requiredTokens.includes(t) && !catalogEntry.optionalTokens.includes(t),
  )

  function mutationErrorAlerts(s: Exclude<ActionResult<{ saved: true }>, { ok: true }>) {
    return (
      <>
        {s.rootError ? (
          <Alert variant='destructive'>
            <AlertTitle>Gagal</AlertTitle>
            <AlertDescription>{s.rootError}</AlertDescription>
          </Alert>
        ) : null}
        {s.fieldErrors?.body ? (
          <Alert variant='destructive'>
            <AlertTitle>Periksa isian</AlertTitle>
            <AlertDescription className='font-mono text-xs whitespace-pre-wrap'>{s.fieldErrors.body}</AlertDescription>
          </Alert>
        ) : null}
      </>
    )
  }

  function insertToken(token: string) {
    focusedEditor?.chain().focus().insertEmailPlaceholder(token).run()
  }

  const requiredDone =
    catalogEntry.requiredTokens.length - validation.missingRequired.length
  const requiredTotal = catalogEntry.requiredTokens.length

  return (
    <div className='space-y-8'>
      <header className='border-border space-y-4 border-b pb-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='min-w-0 space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-semibold tracking-tight'>{catalogEntry.labelId}</h1>
              <Badge variant={isCustomized ? 'default' : 'secondary'}>{isCustomized ? 'Kustom' : 'Bawaan'}</Badge>
            </div>
            <p className='text-muted-foreground max-w-2xl text-sm leading-relaxed'>{catalogEntry.descriptionId}</p>
            <p className='text-muted-foreground max-w-2xl text-xs leading-relaxed'>
              Header logo/nama klub dan footer kontak diatur di{' '}
              <a href='/admin/settings/branding' className='text-primary font-medium underline'>
                Pengaturan → Branding
              </a>
              .
            </p>
          </div>
          <EmailTemplateSaveActions
            templateKey={templateKey}
            subject={subject}
            bodyJson={bodyJson}
            savePending={savePending}
            resetPending={resetPending}
            canSave={canSave}
            saveDispatch={saveDispatch}
            resetDispatch={resetDispatch}
          />
        </div>

        {requiredTotal > 0 ? (
          <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
            <span className={cn(canSave ? 'text-primary font-medium' : 'text-muted-foreground')}>
              Placeholder wajib: {requiredDone}/{requiredTotal}
            </span>
            {validation.invalidTokens.length > 0 ? (
              <span className='text-destructive'>
                Tidak dikenal: {validation.invalidTokens.map(t => `{${t}}`).join(', ')}
              </span>
            ) : null}
            {!canSave && validation.missingRequired.length > 0 ? (
              <span className='text-muted-foreground'>Lengkapi semua placeholder wajib sebelum menyimpan.</span>
            ) : null}
          </div>
        ) : null}
      </header>

      {saveState?.ok === false ? mutationErrorAlerts(saveState) : null}
      {resetState?.ok === false ? mutationErrorAlerts(resetState) : null}

      <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start'>
        <div className='bg-card divide-border min-w-0 divide-y rounded-xl border shadow-xs'>
          <div className='space-y-2 p-5'>
            <Label htmlFor='email-subject'>Subjek email</Label>
            <Input
              id='email-subject'
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={combinedPending}
              placeholder='Subjek yang dilihat penerima'
            />
          </div>

          <div className='space-y-4 p-5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-muted-foreground text-sm'>Susunan blok</p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={combinedPending}
                onClick={() => setBlocks(addParagraphBlock(blocks))}
              >
                <Plus className='mr-1 size-4' aria-hidden />
                Paragraf
              </Button>
            </div>

            <div className='space-y-3'>
              {blocks.map((block, index) => {
                const isSystem = block.type !== 'paragraph'
                const label =
                  block.type === 'paragraph'
                    ? 'Paragraf'
                    : (SYSTEM_BLOCK_LABELS[block.type] ?? block.type)

                return (
                  <div
                    key={block.id}
                    className={cn(
                      'rounded-lg transition-shadow',
                      isSystem && 'bg-muted/40 px-3 py-2',
                      !isSystem && 'space-y-2',
                      dropOverBlockId === block.id &&
                        dragBlockId &&
                        dragBlockId !== block.id &&
                        'ring-primary ring-2 ring-offset-2 ring-offset-background',
                    )}
                    onDragOver={e => {
                      e.preventDefault()
                      if (!combinedPending && dragBlockId && dragBlockId !== block.id) {
                        setDropOverBlockId(block.id)
                      }
                    }}
                    onDragLeave={() => {
                      if (dropOverBlockId === block.id) setDropOverBlockId(null)
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      if (combinedPending || !dragBlockId || dragBlockId === block.id) return
                      setBlocks(reorderEmailBlocks(blocks, dragBlockId, block.id))
                      setDragBlockId(null)
                      setDropOverBlockId(null)
                    }}
                  >
                    {isSystem ? (
                      <SystemBlockRow
                        label={label}
                        hint={SYSTEM_BLOCK_HINTS[block.type] ?? 'Diisi otomatis saat email dikirim.'}
                        index={index}
                        total={blocks.length}
                        combinedPending={combinedPending}
                        onDragStart={() => setDragBlockId(block.id)}
                        onDragEnd={() => {
                          setDragBlockId(null)
                          setDropOverBlockId(null)
                        }}
                        onMoveUp={() => setBlocks(moveEmailBlock(blocks, block.id, -1))}
                        onMoveDown={() => setBlocks(moveEmailBlock(blocks, block.id, 1))}
                      />
                    ) : (
                      <>
                        <ParagraphBlockHeader
                          index={index}
                          total={blocks.length}
                          canDelete={blocks.filter(b => b.type === 'paragraph').length > 1}
                          combinedPending={combinedPending}
                          onDragStart={() => setDragBlockId(block.id)}
                          onDragEnd={() => {
                            setDragBlockId(null)
                            setDropOverBlockId(null)
                          }}
                          onMoveUp={() => setBlocks(moveEmailBlock(blocks, block.id, -1))}
                          onMoveDown={() => setBlocks(moveEmailBlock(blocks, block.id, 1))}
                          onDelete={() => setBlocks(removeParagraphBlock(blocks, block.id))}
                        />
                        <EmailParagraphEditor
                          templateKey={templateKey}
                          catalogEntry={catalogEntry}
                          value={block.doc}
                          disabled={combinedPending}
                          onChange={doc => setBlocks(updateParagraphDoc(blocks, block.id, doc))}
                          onEditorReady={setFocusedEditor}
                        />
                      </>
                    )}

                    {block.type === 'cta_button' ? (
                      <div className='mt-2 space-y-2 border-t border-border/60 pt-3'>
                        <Label htmlFor={`cta-${block.id}`}>Label tombol</Label>
                        <Input
                          id={`cta-${block.id}`}
                          value={block.label}
                          disabled={combinedPending}
                          onChange={e => setBlocks(updateBlockField(blocks, block.id, { label: e.target.value }))}
                        />
                      </div>
                    ) : null}

                    {block.type === 'footer_disclaimer' ? (
                      <div className='mt-2 space-y-2 border-t border-border/60 pt-3'>
                        <Label htmlFor={`footer-${block.id}`}>Teks footer</Label>
                        <Input
                          id={`footer-${block.id}`}
                          value={block.text}
                          disabled={combinedPending}
                          onChange={e => setBlocks(updateBlockField(blocks, block.id, { text: e.target.value }))}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {!canSave && validation.missingRequired.length > 0 ? (
              <p className='text-muted-foreground text-xs lg:hidden'>
                {validation.missingRequired.length} placeholder wajib belum dipakai.
              </p>
            ) : null}
          </div>
        </div>

        <aside className='min-w-0'>
          <EmailTemplateVariableSidebar
            requiredTokens={catalogEntry.requiredTokens}
            optionalTokens={catalogEntry.optionalTokens}
            tokenMeta={catalogEntry.tokenMeta}
            missingRequired={validation.missingRequired}
            onInsert={insertToken}
            disabled={combinedPending}
            systemOnlyTokens={systemOnlyTokens}
          />
        </aside>
      </div>

      <EmailTemplatePreviewPanel html={previewHtml} pending={previewPending} subject={subject} />

      <footer className='border-border flex flex-wrap items-center justify-between gap-4 border-t pt-6'>
        <p className='text-muted-foreground text-xs leading-relaxed'>
          Perubahan disimpan ke template email komite. Email terkirim memakai branding klub saat ini.
        </p>
        <EmailTemplateSaveActions
          templateKey={templateKey}
          subject={subject}
          bodyJson={bodyJson}
          savePending={savePending}
          resetPending={resetPending}
          canSave={canSave}
          saveDispatch={saveDispatch}
          resetDispatch={resetDispatch}
        />
      </footer>
    </div>
  )
}

function BlockReorderControls(props: {
  index: number
  total: number
  combinedPending: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete?: () => void
}) {
  return (
    <div className='flex shrink-0 items-center gap-0.5'>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        disabled={props.combinedPending || props.index === 0}
        onClick={props.onMoveUp}
        title='Pindah ke atas'
      >
        <ChevronUp className='size-4' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        disabled={props.combinedPending || props.index === props.total - 1}
        onClick={props.onMoveDown}
        title='Pindah ke bawah'
      >
        <ChevronDown className='size-4' />
      </Button>
      {props.onDelete ? (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          disabled={props.combinedPending}
          onClick={props.onDelete}
          title='Hapus paragraf'
        >
          <X className='size-4' />
        </Button>
      ) : null}
    </div>
  )
}

function SystemBlockRow(props: {
  label: string
  hint: string
  index: number
  total: number
  combinedPending: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className='flex items-center gap-2'>
      <button
        type='button'
        className='text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing disabled:cursor-not-allowed'
        draggable={!props.combinedPending}
        disabled={props.combinedPending}
        title='Seret untuk mengubah urutan'
        aria-label='Seret untuk mengubah urutan blok'
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
      >
        <GripVertical className='size-4' aria-hidden />
      </button>
      <Lock className='text-muted-foreground size-3.5 shrink-0' aria-hidden />
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium'>{props.label}</p>
        <p className='text-muted-foreground text-xs'>{props.hint}</p>
      </div>
      <BlockReorderControls
        index={props.index}
        total={props.total}
        combinedPending={props.combinedPending}
        onMoveUp={props.onMoveUp}
        onMoveDown={props.onMoveDown}
      />
    </div>
  )
}

function ParagraphBlockHeader(props: {
  index: number
  total: number
  canDelete: boolean
  combinedPending: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  return (
    <div className='flex items-center gap-2'>
      <button
        type='button'
        className='text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing disabled:cursor-not-allowed'
        draggable={!props.combinedPending}
        disabled={props.combinedPending}
        title='Seret untuk mengubah urutan'
        aria-label='Seret untuk mengubah urutan blok'
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
      >
        <GripVertical className='size-4' aria-hidden />
      </button>
      <span className='text-sm font-medium'>Paragraf</span>
      <BlockReorderControls
        index={props.index}
        total={props.total}
        combinedPending={props.combinedPending}
        onMoveUp={props.onMoveUp}
        onMoveDown={props.onMoveDown}
        onDelete={props.canDelete ? props.onDelete : undefined}
      />
    </div>
  )
}
