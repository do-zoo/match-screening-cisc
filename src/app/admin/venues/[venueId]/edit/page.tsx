import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { VenueBasicsForm } from '@/components/admin/venues/venue-basics-form'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'

export async function generateMetadata({ params }: { params: Promise<{ venueId: string }> }): Promise<Metadata> {
  const { venueId } = await params
  const v = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { name: true },
  })
  return { title: v ? `Info dasar · ${v.name}` : 'Info dasar venue' }
}

export default async function AdminVenueEditBasicsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params
  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) notFound()

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      name: true,
      address: true,
      mapUrl: true,
      updatedAt: true,
    },
  })

  if (!venue) notFound()

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Info dasar venue</h1>
        <p className='text-muted-foreground text-sm'>Harga dan gambar menu diatur di halaman Menu kanonik.</p>
      </header>

      <VenueBasicsForm
        key={`${venue.id}:${venue.updatedAt.toISOString()}`}
        venueId={venue.id}
        initialName={venue.name}
        initialAddress={venue.address}
        initialMapUrl={venue.mapUrl}
      />
    </main>
  )
}
