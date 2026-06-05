'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { WaTemplateKey } from '@prisma/client'
import { Check, X } from 'lucide-react'

import { WaTemplateEditor } from '@/components/ui/wa-template-editor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

  return (
    <div className='grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline'>{waTemplateCategoryLabel(catalogEntry.category)}</Badge>
          <Badge variant={isCustomized ? 'default' : 'secondary'}>{isCustomized ? 'Kustom' : 'Bawaan'}</Badge>
        </div>

        {saveState?.ok === false ? mutationErrorAlerts(saveState) : null}
        {resetState?.ok === false ? mutationErrorAlerts(resetState) : null}

        <WaTemplateEditor
          templateKey={templateKey}
          catalogEntry={catalogEntry}
          value={body}
          onChange={setBody}
          disabled={combinedPending}
          onValidationChange={setValidation}
          onEditorReady={setEditor}
        />

        <div className='flex flex-wrap gap-2'>
          <form action={saveDispatch}>
            <input type='hidden' name='key' value={templateKey} />
            <input type='hidden' name='body' value={body} />
            <Button type='submit' disabled={combinedPending || !canSave}>
              Simpan
            </Button>
          </form>
          <form action={resetDispatch}>
            <input type='hidden' name='key' value={templateKey} />
            <Button type='submit' variant='outline' disabled={combinedPending}>
              Reset ke bawaan
            </Button>
          </form>
        </div>
      </div>

      <aside className='flex flex-col gap-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Variabel tersedia</CardTitle>
            <CardDescription>Klik untuk menyisipkan di posisi kursor.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div>
              <p className='text-muted-foreground mb-2 text-xs font-medium'>Wajib</p>
              <ul className='space-y-1.5'>
                {catalogEntry.requiredTokens.map(token => (
                  <li key={token}>
                    <button
                      type='button'
                      className='hover:bg-muted w-full rounded-md border px-2 py-1.5 text-left'
                      onClick={() => insertFromSidebar(token)}
                      disabled={combinedPending}
                    >
                      <span className='font-medium'>{catalogEntry.tokenMeta[token]?.labelId ?? token}</span>
                      <span className='text-muted-foreground block font-mono text-xs'>{`{${token}}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {catalogEntry.optionalTokens.length > 0 ? (
              <div>
                <p className='text-muted-foreground mb-2 text-xs font-medium'>Opsional</p>
                <ul className='space-y-1.5'>
                  {catalogEntry.optionalTokens.map(token => (
                    <li key={token}>
                      <button
                        type='button'
                        className='hover:bg-muted w-full rounded-md border border-dashed px-2 py-1.5 text-left'
                        onClick={() => insertFromSidebar(token)}
                        disabled={combinedPending}
                      >
                        <span className='font-medium'>{catalogEntry.tokenMeta[token]?.labelId ?? token}</span>
                        <span className='text-muted-foreground block font-mono text-xs'>{`{${token}}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Checklist wajib</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className='space-y-1.5 text-sm'>
              {catalogEntry.requiredTokens.map(token => {
                const ok = !validation.missingRequired.includes(token)
                return (
                  <li key={token} className='flex items-center gap-2'>
                    {ok ? (
                      <Check className='text-primary h-4 w-4 shrink-0' aria-hidden />
                    ) : (
                      <X className='text-destructive h-4 w-4 shrink-0' aria-hidden />
                    )}
                    <span className={ok ? '' : 'text-destructive'}>
                      {catalogEntry.tokenMeta[token]?.labelId ?? token}
                    </span>
                  </li>
                )
              })}
            </ul>
            {validation.invalidTokens.length > 0 ? (
              <p className='text-destructive mt-3 text-xs'>
                Placeholder tidak dikenal: {validation.invalidTokens.map(t => `{${t}}`).join(', ')}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Pratinjau WA</CardTitle>
            <CardDescription>Contoh nilai dari katalog variabel.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className='text-muted-foreground font-mono text-xs whitespace-pre-wrap'>{previewText}</pre>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
