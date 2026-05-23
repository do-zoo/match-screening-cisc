'use client'

import * as React from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { MapEmbedPreview } from '@/components/map-embed-preview'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { saveVenueBasics } from '@/lib/actions/admin-venues'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { cn } from '@/lib/utils'

export function VenueBasicsForm({
  venueId,
  initialName,
  initialAddress,
  initialMapUrl,
}: {
  venueId: string
  initialName: string
  initialAddress: string
  initialMapUrl: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [name, setName] = React.useState(initialName)
  const [address, setAddress] = React.useState(initialAddress)
  const [mapUrl, setMapUrl] = React.useState(initialMapUrl ?? '')

  async function submit() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('name', name)
      formData.set('address', address)
      formData.set('mapUrl', mapUrl)
      const res = await saveVenueBasics(venueId, formData)
      if (res.ok) {
        toastCudSuccess('update', 'Info dasar venue disimpan.')
        router.refresh()
      } else {
        toastActionErr(res)
      }
    })
  }

  return (
    <div className='space-y-4'>
      <div className='grid gap-4'>
        <div className='grid gap-2'>
          <Label htmlFor='vName'>Nama venue</Label>
          <Input id='vName' value={name} onChange={e => setName(e.target.value)} disabled={pending} />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='vAddr'>Alamat</Label>
          <Textarea id='vAddr' rows={3} value={address} onChange={e => setAddress(e.target.value)} disabled={pending} />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='vMapUrl'>Tautan peta (opsional)</Label>
          <Input
            id='vMapUrl'
            type='url'
            inputMode='url'
            autoComplete='off'
            placeholder='https://maps.google.com/?q=…'
            value={mapUrl}
            onChange={e => setMapUrl(e.target.value)}
            disabled={pending}
          />
          <p className='text-muted-foreground text-xs'>
            URL https ke Google Maps, Apple Maps, atau short link. Kosongkan bila tidak dipakai.
          </p>

          <MapEmbedPreview
            className='mt-2'
            placeName={name}
            placeAddress={address}
            mapUrl={mapUrl}
            iframeTitle='Pratinjau lokasi venue di Google Maps'
          />
        </div>
      </div>
      <div className='flex flex-wrap gap-2 justify-end'>
        <Link href='/admin/venues' className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex shrink-0')}>
          Kembali ke daftar
        </Link>
        <Button type='button' disabled={pending} onClick={() => submit()}>
          Simpan
        </Button>
      </div>
    </div>
  )
}
