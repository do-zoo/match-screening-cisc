'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import {
  BrandingContactIconAddon,
  BrandingContactInputGroup,
  BrandingContactLocationGroup,
  BrandingContactSection,
  BrandingSocialUrlHint,
} from '@/components/admin/branding-contact-fields'
import { saveClubBranding } from '@/lib/actions/admin-club-branding'
import type { ClubSocialLink } from '@/lib/branding/club-social-links'
import { MAX_CLUB_SOCIAL_LINKS } from '@/lib/branding/club-social-links-limit'
import { detectContactPlatform } from '@/lib/branding/contact-platform'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileField } from '@/components/ui/file-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import type { ActionResult } from '@/lib/forms/action-result'
import { toastCudSuccess } from '@/lib/client/cud-notify'
import { cn } from '@/lib/utils'

type SocialSlot = { id: string; label: string; url: string }

function initialSocialSlots(links: ClubSocialLink[]): SocialSlot[] {
  if (links.length === 0) {
    return [{ id: 'social-0', label: '', url: '' }]
  }
  return links.map((link, i) => ({
    id: `social-${i}`,
    label: link.label,
    url: link.url,
  }))
}

function nextSocialId(ref: { current: number }) {
  ref.current += 1
  return `social-${ref.current}`
}

export function ClubBrandingSettingsForm(props: {
  initialClubName: string
  initialContactEmail: string
  initialWebsiteUrl: string
  initialLocationText: string
  initialSocialLinks: ClubSocialLink[]
  logoUrl: string | null
}) {
  const formId = useId()
  const socialIdRef = useRef(props.initialSocialLinks.length)
  const [state, dispatch, pending] = useActionState(saveClubBranding, null as ActionResult<{ saved: true }> | null)

  useEffect(() => {
    if (state?.ok) {
      toastCudSuccess('update', 'Branding berhasil disimpan.')
    }
  }, [state])

  const [clubNameNav, setClubNameNav] = useState(props.initialClubName)
  const [contactEmail, setContactEmail] = useState(props.initialContactEmail)
  const [websiteUrl, setWebsiteUrl] = useState(props.initialWebsiteUrl)
  const [locationText, setLocationText] = useState(props.initialLocationText)
  const [socialSlots, setSocialSlots] = useState(() => initialSocialSlots(props.initialSocialLinks))

  function updateSocialSlot(index: number, field: 'label' | 'url', next: string) {
    setSocialSlots(prev => prev.map((row, i) => (i === index ? { ...row, [field]: next } : row)))
  }

  function addSocialSlot() {
    setSocialSlots(prev => {
      if (prev.length >= MAX_CLUB_SOCIAL_LINKS) return prev
      return [...prev, { id: nextSocialId(socialIdRef), label: '', url: '' }]
    })
  }

  function removeSocialSlot(index: number) {
    setSocialSlots(prev => {
      if (prev.length <= 1) return [{ id: nextSocialId(socialIdRef), label: '', url: '' }]
      return prev.filter((_, i) => i !== index)
    })
  }

  const canAddSocial = socialSlots.length < MAX_CLUB_SOCIAL_LINKS

  return (
    <div className='max-w-2xl space-y-6'>
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
            <Label htmlFor={`${formId}-clubNameNav`}>Nama di header publik</Label>
            <Input
              id={`${formId}-clubNameNav`}
              name='clubNameNav'
              required
              value={clubNameNav}
              onChange={e => setClubNameNav(e.target.value)}
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

        <fieldset className='space-y-4' disabled={pending}>
          <legend className='text-sm font-medium'>Kontak & footer</legend>

          <BrandingContactSection
            title='Kontak utama'
            description='Ditampilkan di footer situs publik dan di semua email transaksional. Semua field opsional; kosongkan seluruhnya untuk menyembunyikan footer kontak.'
          >
            <BrandingContactInputGroup
              id={`${formId}-contactEmail`}
              name='contactEmail'
              label='Email kontak'
              platform='email'
              type='email'
              autoComplete='email'
              placeholder='komite@contoh.com'
              value={contactEmail}
              onChange={setContactEmail}
            />
            <BrandingContactInputGroup
              id={`${formId}-websiteUrl`}
              name='websiteUrl'
              label='Website'
              platform='website'
              type='url'
              placeholder='https://…'
              value={websiteUrl}
              onChange={setWebsiteUrl}
            />
            <BrandingContactLocationGroup
              id={`${formId}-locationText`}
              name='locationText'
              label='Lokasi'
              placeholder='Misalnya Tangerang Selatan, Banten'
              value={locationText}
              onChange={setLocationText}
            />
          </BrandingContactSection>

          <BrandingContactSection
            title='Sosial media'
            description={`Tambahkan tautan profil atau kanal (maks. ${MAX_CLUB_SOCIAL_LINKS}). URL wajib https://. Label kosong → nama platform otomatis dari URL.`}
          >
            <ul className='space-y-3'>
              {socialSlots.map((row, i) => {
                const urlPlatform = detectContactPlatform(row.url)
                return (
                  <li
                    key={row.id}
                    className='border-border/60 bg-background/50 space-y-3 rounded-lg border p-3 sm:p-4'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                        Tautan {i + 1}
                      </span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        className='text-muted-foreground hover:text-destructive shrink-0'
                        aria-label={`Hapus tautan ${i + 1}`}
                        onClick={() => removeSocialSlot(i)}
                      >
                        <Trash2 className='size-4' aria-hidden />
                      </Button>
                    </div>
                    <div className='space-y-1.5'>
                      <Label htmlFor={`${formId}-socialLabel${i}`}>Label tampilan (opsional)</Label>
                      <Input
                        id={`${formId}-socialLabel${i}`}
                        name={`socialLabel${i}`}
                        placeholder='Kosongkan untuk nama platform otomatis'
                        value={row.label}
                        onChange={e => updateSocialSlot(i, 'label', e.target.value)}
                        maxLength={40}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label htmlFor={`${formId}-socialUrl${i}`}>URL</Label>
                      <InputGroup className='h-9'>
                        <BrandingContactIconAddon platform={urlPlatform} />
                        <InputGroupInput
                          id={`${formId}-socialUrl${i}`}
                          name={`socialUrl${i}`}
                          type='url'
                          placeholder='https://…'
                          value={row.url}
                          onChange={e => updateSocialSlot(i, 'url', e.target.value)}
                        />
                      </InputGroup>
                      <BrandingSocialUrlHint url={row.url} />
                    </div>
                  </li>
                )
              })}
            </ul>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='w-full sm:w-auto'
              disabled={!canAddSocial}
              onClick={addSocialSlot}
            >
              <Plus className='mr-2 size-4' aria-hidden />
              Tambah tautan
            </Button>
            {!canAddSocial ? (
              <p className='text-muted-foreground text-xs'>Maksimum {MAX_CLUB_SOCIAL_LINKS} tautan tercapai.</p>
            ) : null}
          </BrandingContactSection>
        </fieldset>

        <Button type='submit' disabled={pending} className={cn(pending && 'min-w-28')}>
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
