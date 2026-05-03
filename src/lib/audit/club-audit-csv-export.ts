import Papa from "papaparse";

import { prisma } from "@/lib/db/prisma";

import {
  buildClubAuditWhere,
  type ClubAuditListFilters,
  type ClubAuditRowVm,
} from "./load-recent-club-audit";

export const CLUB_AUDIT_EXPORT_MAX_ROWS = 10_000;

export type ClubAuditExportFilters = ClubAuditListFilters;

export async function loadClubAuditLogsForCsvExport(
  filters: ClubAuditExportFilters,
): Promise<ClubAuditRowVm[]> {
  const where = buildClubAuditWhere(filters);
  const rows = await prisma.clubAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CLUB_AUDIT_EXPORT_MAX_ROWS,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actorAuthUserId: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: r.metadata,
    createdAtIso: r.createdAt.toISOString(),
    actorAuthUserId: r.actorAuthUserId,
  }));
}

export function buildClubAuditExportCsv(rows: ClubAuditRowVm[]): string {
  const records = rows.map((r) => ({
    id: r.id,
    created_at_utc: r.createdAtIso,
    action: r.action,
    actor_auth_user_id: r.actorAuthUserId,
    target_type: r.targetType ?? "",
    target_id: r.targetId ?? "",
    metadata_json: JSON.stringify(r.metadata ?? null),
  }));

  const body =
    Papa.unparse(records, {
      columns: [
        "id",
        "created_at_utc",
        "action",
        "actor_auth_user_id",
        "target_type",
        "target_id",
        "metadata_json",
      ],
    }) + "\n";

  return `\ufeff${body}`;
}
