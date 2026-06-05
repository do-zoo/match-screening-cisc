import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'

export function WaTemplatesIndexHeader() {
  return (
    <div>
      <AdminSettingsBreadcrumb
        crumbs={[
          { label: 'Pengaturan', href: '/admin/settings' },
          { label: 'Template pesan', href: '/admin/settings/templates' },
          { label: 'WhatsApp' },
        ]}
      />
      <h1 className='text-2xl font-semibold tracking-tight'>Template WhatsApp</h1>
      <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed'>
        Tujuh pesan untuk tautan wa.me di admin. Gunakan placeholder{' '}
        <code className='text-xs'>{`{snake_case}`}</code> dan format WhatsApp (*tebal*, _miring_, daftar, dll.). Jika
        validasi gagal saat kirim, aplikasi memakai teks bawaan kode.
      </p>
    </div>
  )
}
