'use client'

import { useActionState, useEffect } from 'react'

import { EmailTemplateKey } from '@prisma/client'

import { resetClubEmailTemplate, saveClubEmailTemplate } from '@/lib/actions/admin-club-email-templates'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/forms/action-result'
import { toastCudSuccess } from '@/lib/client/cud-notify'
import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import { REQUIRED_EMAIL_TOKENS } from '@/lib/email-templates/email-template-policy'

const ORDER: EmailTemplateKey[] = [EmailTemplateKey.invoice_underpayment, EmailTemplateKey.magic_link]

const LABELS: Record<EmailTemplateKey, string> = {
  invoice_underpayment: 'Tagihan kekurangan bayar',
  magic_link: 'Magic link masuk admin',
}

export function ClubEmailTemplatesPanel(props: {
  initialFromDb: Partial<Record<EmailTemplateKey, { subject: string; body: string }>>
}) {
  return (
    <div className='space-y-6'>
      <p className='text-muted-foreground text-sm'>
        Subjek dan isi email memakai placeholder <code className='text-xs'>{`{contact_name}`}</code>. Jika
        penyimpanan gagal validasi, pengiriman memakai teks bawaan aplikasi.
      </p>
      <div className='flex flex-col gap-8'>
        {ORDER.map(key => (
          <ClubEmailTemplateKeyCard key={key} emailKey={key} displayDb={props.initialFromDb[key]} />
        ))}
      </div>
    </div>
  )
}

function ClubEmailTemplateKeyCard(props: {
  emailKey: EmailTemplateKey
  displayDb?: { subject: string; body: string }
}) {
  const { emailKey } = props
  const defaults = REQUIRED_EMAIL_TOKENS[emailKey].map(t => `{${t}}`).join(', ')
  const fallback = CLUB_EMAIL_DEFAULT_BODIES[emailKey]
  const displaySubject = props.displayDb?.subject ?? fallback.subject
  const displayBody = props.displayDb?.body ?? fallback.body

  const initialState = null as ActionResult<{ saved: true }> | null
  const [saveState, saveDispatch, savePending] = useActionState(saveClubEmailTemplate, initialState)
  const [resetState, resetDispatch, resetPending] = useActionState(resetClubEmailTemplate, initialState)

  useEffect(() => {
    if (saveState?.ok) toastCudSuccess('update', 'Template email disimpan.')
  }, [saveState])

  useEffect(() => {
    if (resetState?.ok) toastCudSuccess('update', 'Template email dikembalikan ke default.')
  }, [resetState])

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

  const combinedPending = savePending || resetPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{LABELS[emailKey]}</CardTitle>
        <CardDescription>
          Wajib mencakup minimal: <span className='font-mono text-xs'>{defaults}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {saveState?.ok === false ? mutationErrorAlerts(saveState) : null}
        {resetState?.ok === false ? mutationErrorAlerts(resetState) : null}
        <form action={saveDispatch} className='space-y-3'>
          <input type='hidden' name='key' value={emailKey} />
          <div className='space-y-2'>
            <Label htmlFor={`email-subject-${emailKey}`}>Subjek</Label>
            <Input
              id={`email-subject-${emailKey}`}
              name='subject'
              required
              defaultValue={displaySubject}
              disabled={combinedPending}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor={`email-body-${emailKey}`}>Isi pesan</Label>
            <Textarea
              id={`email-body-${emailKey}`}
              name='body'
              required
              defaultValue={displayBody}
              rows={12}
              className='font-mono text-xs md:text-sm'
              disabled={combinedPending}
            />
          </div>
          <Button type='submit' disabled={combinedPending}>
            Simpan
          </Button>
        </form>
      </CardContent>
      <CardFooter className='justify-start border-t pt-4'>
        <form action={resetDispatch}>
          <input type='hidden' name='key' value={emailKey} />
          <Button type='submit' variant='outline' size='sm' disabled={combinedPending}>
            Reset ke bawaan
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
