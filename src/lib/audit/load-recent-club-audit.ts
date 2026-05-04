import { cache } from "react";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { resolveClampedPage } from "@/lib/table/admin-pagination";

export const CLUB_AUDIT_PAGE_SIZE = 10;

export type ClubAuditRowVm = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAtIso: string;
  actorAuthUserId: string;
};

export type ClubAuditListFilters = {
  /** `YYYY-MM-DD` (UTC hari) atau string tanggal-waktu yang diparsing `Date` */
  from?: string;
  /** `YYYY-MM-DD` (UTC hari, sampai akhir hari) atau string tanggal-waktu */
  to?: string;
  /** Exact match ke kolom `action` */
  action?: string;
  /** Cocokkan awalan `action` (mis. `admin_profile.`) — digabung AND dengan filter lainnya. */
  actionPrefix?: string;
  /** Substring pada `actorAuthUserId` (tanpa membedakan huruf besar/kecil) */
  userId?: string;
};

function parseRangeBound(
  raw: string | undefined,
  kind: "start" | "end",
): Date | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim();
  if (s === "") return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split("-").map((x) => Number.parseInt(x, 10));
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(mo) ||
      !Number.isFinite(d)
    ) {
      return undefined;
    }
    if (kind === "start") {
      return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
    }
    return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export function buildClubAuditWhere(
  filters: ClubAuditListFilters,
): Prisma.ClubAuditLogWhereInput {
  const clauses: Prisma.ClubAuditLogWhereInput[] = [];

  const fromDt = parseRangeBound(filters.from, "start");
  if (fromDt) clauses.push({ createdAt: { gte: fromDt } });

  const toDt = parseRangeBound(filters.to, "end");
  if (toDt) clauses.push({ createdAt: { lte: toDt } });

  const action = filters.action?.trim();
  if (action) clauses.push({ action });

  const actionPrefix = filters.actionPrefix?.trim();
  if (actionPrefix) clauses.push({ action: { startsWith: actionPrefix } });

  const userId = filters.userId?.trim();
  if (userId) {
    clauses.push({
      actorAuthUserId: { contains: userId, mode: "insensitive" },
    });
  }

  if (clauses.length === 0) return {};
  return { AND: clauses };
}

export type ClubAuditPageResult = {
  rows: ClubAuditRowVm[];
  totalItems: number;
  /** Halaman efektif setelah diklam terhadap `totalItems` */
  page: number;
};

export const loadClubAuditList = cache(
  async (
    requestedPage: number,
    filters: ClubAuditListFilters,
  ): Promise<ClubAuditPageResult> => {
    const where = buildClubAuditWhere(filters);
    const totalItems = await prisma.clubAuditLog.count({ where });
    const page = resolveClampedPage(
      requestedPage,
      totalItems,
      CLUB_AUDIT_PAGE_SIZE,
    );
    const skip = (page - 1) * CLUB_AUDIT_PAGE_SIZE;

    const rows = await prisma.clubAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: CLUB_AUDIT_PAGE_SIZE,
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

    return {
      totalItems,
      page,
      rows: rows.map((r) => ({
        id: r.id,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        metadata: r.metadata,
        createdAtIso: r.createdAt.toISOString(),
        actorAuthUserId: r.actorAuthUserId,
      })),
    };
  },
);
