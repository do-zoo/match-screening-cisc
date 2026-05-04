import { NextRequest, NextResponse } from "next/server";

import {
  buildClubAuditExportCsv,
  loadClubAuditLogsForCsvExport,
} from "@/lib/audit/club-audit-csv-export";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

function firstString(param: string | null): string | undefined {
  if (param === null || param === undefined) return undefined;
  const t = param.trim();
  return t === "" ? undefined : t;
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = firstString(searchParams.get("from"));
  const to = firstString(searchParams.get("to"));
  const actionPrefix =
    firstString(searchParams.get("actionPrefix")) ?? "admin_profile.";

  const rows = await loadClubAuditLogsForCsvExport({
    from,
    to,
    actionPrefix,
  });

  const csv = buildClubAuditExportCsv(rows);
  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `club-audit-${isoDate}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
