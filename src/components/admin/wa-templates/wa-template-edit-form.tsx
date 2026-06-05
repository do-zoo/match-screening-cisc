'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { WaTemplateKey } from '@prisma/client'

import { WaTemplateEditor } from '@/components/ui/wa-template-editor'
import { TemplateChecklistPanel } from '@/components/admin/templates/template-checklist-panel'
import { TemplateEditorActions } from '@/components/admin/templates/template-editor-actions'
import { TemplateEditorLayout } from '@/components/admin/templates/template-editor-layout'
import { TemplateVariablePanel } from '@/components/admin/templates/template-variable-panel'
import { WaTemplatePreviewPanel } from '@/components/admin/wa-templates/wa-template-preview-panel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { resetClubWaTemplateBody, saveClubWaTemplateBody } from '@/lib/actions/admin-club-wa-templates'
import { toastCudSuccess } from '@/lib/client/cud-notify'
import type { ActionResult } from '@/lib/forms/action-result'
import type { WaTemplateCatalogEntry } from '@/lib/wa-templates/wa-template-catalog'
import {
  analyzeWaTemplateMarkdown,
  sampleVarsFromCatalog,
} from '@/lib/wa-templates/wa-template-editor-validation'
import { applyWaPlaceholders } from '@/lib/wa-templates/wa-placeholder'
import { waTemplateCategoryLabel } from '@/lib/wa-templates/filter-wa-templates-index'

export function WaTemplateEditForm(props: {
  templateKey: WaTemplateKey
  catalogEntry: WaTemplateCatalogEntry
  displayBody: string
  isCustomized: boolean
}) {
  const router = useRouter()
  const { templateKey, catalogEntry, isCustomized } = props
  const [body, setBody] = useState(props.displayBody)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [validation, setValidation] = useState(() => analyzeWaTemplateMarkdown(props.displayBody, catalogEntry))

  const initialState = null as ActionResult<{ saved: true }> | null
  const [saveState, saveDispatch, savePending] = useActionState(saveClubWaTemplateBody, initialState)
  const [resetState, resetDispatch, resetPending] = useActionState(resetClubWaTemplateBody, initialState)

  useEffect(() => {
    if (saveState?.ok) toastCudSuccess('update', 'Template WA disimpan.')
  }, [saveState])

  useEffect(() => {
    if (resetState?.ok) {
      toastCudSuccess('update', 'Template WA dikembalikan ke bawaan.')
      router.refresh()
    }
  }, [resetState, router])

  const previewText = useMemo(() => {
    try {
      return applyWaPlaceholders(body, sampleVarsFromCatalog(catalogEntry))
    } catch {
      return 'Pratinjau tidak tersedia — periksa placeholder.'
    }
  }, [body, catalogEntry])

  const canSave =
    validation.missingRequired.length === 0 && validation.invalidTokens.length === 0 && body.trim().length > 0

  const combinedPending = savePending || resetPending

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

  function insertFromSidebar(token: string) {
    const allowed = new Set([...catalogEntry.requiredTokens, ...catalogEntry.optionalTokens])
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'waPlaceholder',
        attrs: { token, invalid: !allowed.has(token) },
      })
      .run()
  }

  const saveHint =
    !canSave && validation.missingRequired.length > 0
      ? 'Lengkapi semua placeholder wajib sebelum menyimpan.'
      : !canSave && body.trim().length === 0
        ? 'Isi pesan template terlebih dahulu.'
        : undefined

  return (
    <TemplateEditorLayout
      main={
        <>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline'>{waTemplateCategoryLabel(catalogEntry.category)}</Badge>
            <Badge variant={isCustomized ? 'default' : 'secondary'}>{isCustomized ? 'Kustom' : 'Bawaan'}</Badge>
          </div>

          {saveState?.ok === false ? mutationErrorAlerts(saveState) : null}
          {resetState?.ok === false ? mutationErrorAlerts(resetState) : null}

          <section className='space-y-2'>
            <div>
              <h2 className='text-sm font-semibold'>Isi pesan</h2>
              <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                Format WhatsApp (*tebal*, _miring_, daftar). Ketik{' '}
                <code className='text-xs'>{'{'}</code> untuk saran variabel.
              </p>
            </div>
            <WaTemplateEditor
              templateKey={templateKey}
              catalogEntry={catalogEntry}
              value={body}
              onChange={setBody}
              disabled={combinedPending}
              onValidationChange={setValidation}
              onEditorReady={setEditor}
            />
          </section>

          <TemplateEditorActions
            templateKey={templateKey}
            savePending={savePending}
            resetPending={resetPending}
            canSave={canSave}
            saveDispatch={saveDispatch}
            resetDispatch={resetDispatch}
            saveHint={saveHint}
            saveHiddenFields={<input type='hidden' name='body' value={body} />}
          />
        </>
      }
      sidebar={
        <>
          <TemplateVariablePanel
            requiredTokens={catalogEntry.requiredTokens}
            optionalTokens={catalogEntry.optionalTokens}
            tokenMeta={catalogEntry.tokenMeta}
            onInsert={insertFromSidebar}
            disabled={combinedPending}
          />
          <TemplateChecklistPanel
            requiredTokens={catalogEntry.requiredTokens}
            tokenMeta={catalogEntry.tokenMeta}
            missingRequired={validation.missingRequired}
            invalidTokens={validation.invalidTokens}
          />
          <WaTemplatePreviewPanel text={previewText} />
        </>
      }
    />
  )
}
