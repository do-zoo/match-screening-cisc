import { prisma } from '@/lib/db/prisma'
import type { AdminContext } from '@/lib/permissions/guards'
import { canVerifyEvent } from '@/lib/permissions/guards'
import { hasGlobalVerifierAccess } from '@/lib/permissions/roles'

async function verifiableEventIds(ctx: AdminContext): Promise<string[]> {
  if (hasGlobalVerifierAccess(ctx.role)) {
    const rows = await prisma.event.findMany({ select: { id: true } })
    return rows.map(r => r.id).filter(id => canVerifyEvent(ctx, id))
  }
  return ctx.helperEventIds.filter(id => canVerifyEvent(ctx, id))
}

/** Total registrasi `pending_review` pada semua acara yang boleh diverifikasi konteks ini. */
export async function getPendingReviewTotalForAdminContext(ctx: AdminContext): Promise<number> {
  const ids = await verifiableEventIds(ctx)
  if (ids.length === 0) return 0
  return prisma.registration.count({
    where: { eventId: { in: ids }, status: 'pending_review' },
  })
}
