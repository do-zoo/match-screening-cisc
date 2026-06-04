'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { AdminAccountTwoFactorSection } from '@/components/admin/admin-account-two-factor-section'
import { ThemePreferenceField } from '@/components/admin/theme-preference-field'
import { Button } from '@/components/ui/button'
import { FileField } from '@/components/ui/file-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeAdminDisplayName } from '@/lib/admin/normalize-admin-display-name'
import { updateAdminAvatar } from '@/lib/actions/update-admin-avatar'
import { updateAdminDisplayName } from '@/lib/actions/update-admin-display-name'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'

type FormValues = { name: string }

export function AdminAccountPageClient({
  initialName,
  email,
  initialTwoFactorEnabled,
  initialAvatarUrl,
}: {
  initialName: string
  email: string
  initialTwoFactorEnabled: boolean
  initialAvatarUrl: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [avatarFile, setAvatarFile] = useState<File | undefined>()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [avatarPending, startAvatarTransition] = useTransition()
  const [avatarError, setAvatarError] = useState<string | null>(null)

  function handleAvatarUpload() {
    if (!avatarFile) {
      setAvatarError('Pilih berkas gambar terlebih dahulu.')
      return
    }
    setAvatarError(null)
    startAvatarTransition(async () => {
      const fd = new FormData()
      fd.set('avatar', avatarFile)
      const res = await updateAdminAvatar(fd)
      if (!res.ok) {
        setAvatarError(res.rootError ?? 'Gagal mengunggah avatar.')
        return
      }
      setAvatarUrl(res.data.url)
      setAvatarFile(undefined)
      toastCudSuccess('update', 'Avatar diperbarui.')
      router.refresh()
    })
  }

  const form = useForm<FormValues>({
    defaultValues: { name: initialName },
  })

  const rootErr = form.formState.errors.root?.message

  return (
    <div className='mx-auto flex w-full max-w-lg flex-col gap-8 px-4 md:px-6 py-8 lg:py-10'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Akun</h1>
        <p className='text-sm text-muted-foreground'>
          Nama tampilan dan tampilan antarmuka. Email dikelola lewat akun masuk Anda.
        </p>
      </header>

      <section className='flex flex-col gap-4 rounded-lg border bg-card p-6'>
        <div className='flex flex-col gap-1'>
          <h2 className='text-base font-semibold'>Foto profil</h2>
          <p className='text-sm text-muted-foreground'>Ditampilkan di menu akun dan header admin.</p>
        </div>

        <div className='flex items-center gap-4'>
          <span className='relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted'>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt='Avatar saat ini'
                width={64}
                height={64}
                className='h-full w-full object-cover'
              />
            ) : (
              <span className='flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground'>
                {initialName.trim() ? initialName.trim()[0].toUpperCase() : (email[0]?.toUpperCase() ?? 'A')}
              </span>
            )}
          </span>
          <div className='flex min-w-0 flex-col gap-1'>
            <p className='text-sm font-medium'>{avatarUrl ? 'Ganti foto profil' : 'Unggah foto profil'}</p>
            <p className='text-xs text-muted-foreground'>JPG, PNG, atau WebP. Maks 8 MB.</p>
          </div>
        </div>

        <FileField
          id='avatar-upload'
          label='Pilih foto'
          accept='image/*'
          pickPrompt='Ketuk untuk memilih foto'
          replacePrompt='Ganti foto'
          maxSizeBytes={8 * 1024 * 1024}
          onChange={setAvatarFile}
          disabled={avatarPending}
        />

        {avatarError ? (
          <p className='text-sm text-destructive' role='alert'>
            {avatarError}
          </p>
        ) : null}

        <Button type='button' onClick={handleAvatarUpload} disabled={!avatarFile || avatarPending}>
          {avatarPending ? 'Mengunggah…' : 'Simpan foto'}
        </Button>
      </section>

      <section className='flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='email'>Email</Label>
          <Input id='email' value={email} readOnly className='bg-muted/50' />
        </div>

        <form
          className='flex flex-col gap-4'
          onSubmit={form.handleSubmit(values => {
            startTransition(async () => {
              form.clearErrors('root')
              form.clearErrors('name')
              const fd = new FormData()
              fd.set('name', values.name)
              const res = await updateAdminDisplayName(fd)
              if (!res.ok) {
                toastActionErr(res)
                if (res.fieldErrors?.name) {
                  form.setError('name', { message: res.fieldErrors.name })
                }
                if (res.rootError) {
                  form.setError('root', { message: res.rootError })
                }
                return
              }
              toastCudSuccess('update', 'Nama tampilan diperbarui.')
              router.refresh()
            })
          })}
        >
          <div className='flex flex-col gap-2'>
            <Label htmlFor='name'>Nama tampilan</Label>
            <Input
              id='name'
              {...form.register('name', {
                validate: value => {
                  const r = normalizeAdminDisplayName(value)
                  return r.ok ? true : r.message
                },
              })}
              disabled={pending}
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name?.message ? (
              <p className='text-sm text-destructive'>{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          {rootErr ? <p className='text-sm text-destructive'>{rootErr}</p> : null}
          <Button type='submit' disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan nama'}
          </Button>
        </form>

        <p className='text-xs text-muted-foreground'>
          <Link href='/admin' className='text-primary underline-offset-4 hover:underline'>
            Kembali ke beranda admin
          </Link>
        </p>
      </section>

      <AdminAccountTwoFactorSection initialTwoFactorEnabled={initialTwoFactorEnabled} />

      <section className='flex flex-col gap-3 rounded-lg border bg-card p-4 md:p-6'>
        <ThemePreferenceField />
      </section>
    </div>
  )
}
