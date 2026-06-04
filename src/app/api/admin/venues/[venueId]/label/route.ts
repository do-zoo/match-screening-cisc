import { NextResponse } from 'next/server'

import { getAdminContext } from '@/lib/auth/admin-context'
import { getAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'

export async function GET(_req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const ctx = await getAdminContext(session.user.id)
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    return new NextResponse(null, { status: 404 })
  }

  const { venueId } = await params
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { name: true },
  })
  if (!venue) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.json({ name: venue.name })
}
