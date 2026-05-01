import type { PrismaClient } from "@prisma/client";

import type { ClubAuditAction } from "@/lib/audit/club-audit-actions";
import { sanitizeAuditMetadata } from "@/lib/audit/sanitize-audit-metadata";

export async function appendClubAuditLog(
  db: PrismaClient,
  row: {
    actorProfileId: string;
    actorAuthUserId: string;
    action: ClubAuditAction;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: unknown;
  },
): Promise<void> {
  const metadata = sanitizeAuditMetadata(row.metadata);
  try {
    await db.clubAuditLog.create({
      data: {
        actorAdminProfileId: row.actorProfileId,
        actorAuthUserId: row.actorAuthUserId,
        action: row.action,
        targetType: row.targetType ?? null,
        targetId: row.targetId ?? null,
        metadata: metadata === null ? undefined : metadata,
      },
    });
  } catch (e) {
    console.error("[clubAuditLog] insert failed", { action: row.action, e });
  }
}
