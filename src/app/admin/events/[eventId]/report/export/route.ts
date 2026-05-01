import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { generateRegistrationsCsv } from "@/lib/reports/csv";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canVerifyEvent(ctx, eventId)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true },
  });
  if (!event) return new NextResponse("Not found", { status: 404 });

  const csv = await generateRegistrationsCsv(eventId);
  const filename = `registrations-${event.slug}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
