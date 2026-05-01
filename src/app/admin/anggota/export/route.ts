import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { buildMasterMembersExportCsv } from "@/lib/members/build-master-members-export-csv";
import { listMasterMembersForAdmin } from "@/lib/members/query-admin-master-members";

function parseFilter(v: string | null): "all" | "active" | "inactive" {
  if (v === "active" || v === "inactive") return v;
  return "all";
}

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const filter = parseFilter(searchParams.get("filter"));
  const qRaw = searchParams.get("q") ?? "";
  const q = qRaw.trim().slice(0, 200);

  const rows = await listMasterMembersForAdmin({
    filter,
    q: q === "" ? undefined : q,
  });

  const csv = buildMasterMembersExportCsv(rows);
  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `anggota-cisc-${isoDate}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
