import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/auth/admin-context";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ adminProfileId: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    return new NextResponse(null, { status: 404 });
  }

  const { adminProfileId } = await params;
  const rows = await prisma.picBankAccount.findMany({
    where: { ownerAdminProfileId: adminProfileId, isActive: true },
    orderBy: { bankName: "asc" },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountName: true,
    },
  });

  return NextResponse.json({
    banks: rows.map((r) => ({
      id: r.id,
      label: `${r.bankName} — ${r.accountNumber} (${r.accountName})`,
    })),
  });
}
