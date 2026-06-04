import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdminVenueMenuPanel } from '@/components/admin/venues/admin-venue-menu-panel'
import { parseVenueMenuListSearchParams } from '@/lib/admin/admin-venue-menu-list'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import type { VenueCatalogUiPayload } from '@/lib/forms/venue-catalog-form-schema'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'
import { venueMenuItemIdsFrozenByExistingRegistrations } from '@/lib/venues/venue-menu-frozen-item-ids'

export async function generateMetadata({ params }: { params: Promise<{ venueId: string }> }): Promise<Metadata> {
  const { venueId } = await params
  const v = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { name: true },
  })
  return { title: v ? `Menu · ${v.name}` : 'Menu venue' }
}

export default async function AdminVenueMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { venueId } = await params
  const sp = (await searchParams) ?? {}
  const listQuery = parseVenueMenuListSearchParams(sp)
  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) notFound()

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      menuItems: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          imageBlobUrl: true,
          imageBlobPath: true,
          price: true,
          sortOrder: true,
        },
      },
    },
  })

  if (!venue) notFound()

  const frozenMenuItemIds = await venueMenuItemIdsFrozenByExistingRegistrations(prisma)

  const initialItems: VenueCatalogUiPayload['items'] = venue.menuItems.map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    imageBlobUrl: m.imageBlobUrl,
    imageBlobPath: m.imageBlobPath,
    price: m.price,
    sortOrder: m.sortOrder,
  }))

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10'>
      <AdminVenueMenuPanel
        venueId={venue.id}
        initialItems={initialItems}
        frozenMenuItemIds={[...frozenMenuItemIds]}
        listQuery={listQuery}
      />
    </main>
  )
}
