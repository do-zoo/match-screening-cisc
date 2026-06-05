import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Template pesan' }

export default function TemplatesHubPage() {
  return (
    <div className='space-y-6'>
      <div>
        <AdminSettingsBreadcrumb
          crumbs={[{ label: 'Pengaturan', href: '/admin/settings' }, { label: 'Template pesan' }]}
        />
        <h1 className='text-2xl font-semibold tracking-tight'>Template pesan</h1>
        <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed'>
          Kelola teks WhatsApp untuk tautan admin dan subjek/isi email transaksional. Pilih saluran di bawah.
        </p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <Link href='/admin/settings/templates/whatsapp' className='block transition-opacity hover:opacity-90'>
          <Card className='h-full'>
            <CardHeader>
              <CardTitle className='text-base'>Template WhatsApp</CardTitle>
              <CardDescription>
                Tujuh templat wa.me — editor format WA, variabel wajib/opsional, pratinjau sample.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href='/admin/settings/templates/email' className='block transition-opacity hover:opacity-90'>
          <Card className='h-full'>
            <CardHeader>
              <CardTitle className='text-base'>Template email</CardTitle>
              <CardDescription>
                Tagihan kekurangan bayar dan magic link masuk admin — subjek + isi dengan placeholder.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
