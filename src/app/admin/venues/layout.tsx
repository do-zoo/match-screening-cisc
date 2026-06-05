import { Suspense } from 'react'

import { AdminVenuesIndexFlashHandler } from '@/components/admin/admin-venues-index-flash-handler'

export default function AdminVenuesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminVenuesIndexFlashHandler />
      </Suspense>
      {children}
    </>
  )
}
