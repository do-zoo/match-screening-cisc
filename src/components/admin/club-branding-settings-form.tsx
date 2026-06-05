'use client'

import { useActionState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

import { saveClubBranding } from '@/lib/actions/admin-club-branding'
import type { ClubSocialLink } from '@/lib/branding/club-social-links'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileField } from '@/components/ui/file-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/forms/action-result'
import { toastCudSuccess } from '@/lib/client/cud-notify'

const SOCIAL_SLOT_COUNT = 3

export function ClubBrandingSettingsForm(props: {
  initialClubName: string
  initialContactEmail: string
  initialWebsiteUrl: string
  initialLocationText: string
  initialSocialLinks: ClubSocialLink[]
  logoUrl: string | null
}) {
  const [state, dispatch, pending] = useActionState(saveClubBranding, null as ActionResult<{ saved: true }> | null)

  useEffect(() => {
    if (state?.ok) {
      toastCudSuccess('update', 'Branding berhasil disimpan.')
    }
  }, [state])

  const socialDefaults = Array.from({ length: SOCIAL_SLOT_COUNT }, (_, i) => ({
    label: props.initialSocialLinks[i]?.label ?? '',
    url: props.initialSocialLinks[i]?.url ?? '',
  }))

  return (
    <div className='max-w-xl space-y-6'>
      {state?.ok === false && state.rootError ? (
        <Alert variant='destructive'>
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{state.rootError}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok === false && state.fieldErrors ? (
        <Alert variant='destructive'>
          <AlertTitle>Periksa isian</AlertTitle>
          <AlertDescription className='font-mono text-xs whitespace-pre-wrap'>
            {Object.entries(state.fieldErrors)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')}
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={dispatch} className='space-y-8'>
        <fieldset className='space-y-5' disabled={pending}>
          <legend className='text-sm font-medium'>Identitas</legend>
          <div className='space-y-2'>
            <Label htmlFor='clubNameNav'>Nama di header publik</Label>
            <Input
              id='clubNameNav'
              name='clubNameNav'
              required
              defaultValue={props.initialClubName}
              autoComplete='off'
            />
          </div>
          <FileField
            id='logo'
            name='logo'
            label='Logo klub (opsional, gambar raster)'
            description={
              props.logoUrl
                ? 'Unggah berkas baru untuk mengganti. Lewati jika hanya mengubah teks.'
                : 'Format JPG, PNG, atau WebP.'
            }
            accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
            existingPreviewUrl={props.logoUrl}
            pickPrompt='Ketuk untuk memilih logo'
            replacePrompt='Ganti logo'
          />
        </fieldset>

        <fieldset className='space-y-5' disabled={pending}>
          <legend className='text-sm font-medium'>Kontak & footer</legend>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            Ditampilkan di footer situs publik dan di semua email transaksional. Semua field opsional; kosongkan
            seluruhnya untuk menyembunyikan footer kontak.
          </p>
          <div className='space-y-2'>
            <Label htmlFor='contactEmail'>Email kontak</Label>
            <Input
              id='contactEmail'
              name='contactEmail'
              type='email'
              autoComplete='email'
              placeholder='komite@contoh.com'
              defaultValue={props.initialContactEmail}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='websiteUrl'>Website</Label>
            <Input
              id='websiteUrl'
              name='websiteUrl'
              type='url'
              placeholder='https://…'
              defaultValue={props.initialWebsiteUrl}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='locationText'>Lokasi</Label>
            <Textarea
              id='locationText'
              name='locationText'
              rows={2}
              maxLength={200}
              placeholder='Misalnya Tangerang Selatan, Banten'
              defaultValue={props.initialLocationText}
            />
          </div>
          <div className='space-y-4'>
            <p className='text-sm font-medium'>Sosial media (maks. 3)</p>
            {socialDefaults.map((row, i) => (
              <div key={i} className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor={`socialLabel${i}`}>Label {i + 1}</Label>
                  <Input
                    id={`socialLabel${i}`}
                    name={`socialLabel${i}`}
                    placeholder='Instagram'
                    defaultValue={row.label}
                    maxLength={40}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor={`socialUrl${i}`}>URL {i + 1}</Label>
                  <Input
                    id={`socialUrl${i}`}
                    name={`socialUrl${i}`}
                    type='url'
                    placeholder='https://…'
                    defaultValue={row.url}
                  />
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <Button type='submit' disabled={pending}>
          {pending ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden />
              Menyimpan…
            </>
          ) : (
            'Simpan'
          )}
        </Button>
      </form>
      {state?.ok === true ? <p className='text-sm font-medium text-emerald-600'>Branding disimpan.</p> : null}
    </div>
  )
}
