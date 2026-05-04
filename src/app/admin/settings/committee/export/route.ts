import { NextResponse } from "next/server";

import { buildCommitteeAdminDirectoryExportCsv } from "@/lib/admin/build-committee-admin-directory-export-csv";
import { loadCommitteeAdminDirectory } from "@/lib/admin/load-committee-admin-directory";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export async function GET() {
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

  const directory = await loadCommitteeAdminDirectory();
  const csv = buildCommitteeAdminDirectoryExportCsv(directory);
  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `admin-komite-${isoDate}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
