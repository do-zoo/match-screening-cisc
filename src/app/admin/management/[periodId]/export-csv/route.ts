import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { listPeriodRolesAsTree } from "@/lib/management/query-admin-period-tree";
import { prisma } from "@/lib/db/prisma";

function escCsv(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params;

  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const period = await prisma.boardPeriod.findUnique({
    where: { id: periodId },
    select: { label: true },
  });
  if (!period) return new NextResponse("Not found", { status: 404 });

  const rows = await listPeriodRolesAsTree(periodId);

  const header = ["Jabatan", "Jabatan Induk", "Kapasitas", "Nama Pengurus", "Kode Publik", "Terhubung ke Direktori"];

  const titleById = new Map(rows.map((r) => [r.roleId, r.roleTitle]));

  const lines: string[] = [header.map(escCsv).join(",")];

  for (const row of rows) {
    const parentTitle = row.parentRoleId ? (titleById.get(row.parentRoleId) ?? "") : "";
    const kapasitas = row.roleIsUnique ? "1 orang" : "Banyak";
    if (row.assignees.length === 0) {
      lines.push(
        [row.roleTitle, parentTitle, kapasitas, "", "", ""].map(escCsv).join(","),
      );
    } else {
      for (const a of row.assignees) {
        lines.push(
          [
            row.roleTitle,
            parentTitle,
            kapasitas,
            a.fullName,
            a.publicCode,
            a.masterMemberId ? "Ya" : "Tidak",
          ]
            .map(escCsv)
            .join(","),
        );
      }
    }
  }

  const csv = lines.join("\r\n");
  const filename = `struktur-kepengurusan-${period.label.replace(/\s+/g, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
