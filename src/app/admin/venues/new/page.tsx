import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AdminNewVenueForm } from '@/components/admin/venues/admin-new-venue-form'
import { buttonVariants } from '@/components/ui/button'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Venue baru' }

export default async function AdminNewVenuePage() {
  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) notFound()

  return (
    <main className='mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10'>
      <div className='flex flex-col gap-2'>
        <Link href='/admin/venues' className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit px-0')}>
          ← Daftar venue
        </Link>
        <h1 className='text-2xl font-semibold tracking-tight'>Venue baru</h1>
      </div>

      <AdminNewVenueForm />
    </main>
  )
}
