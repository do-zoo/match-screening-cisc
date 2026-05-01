import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/auth/admin-context";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canVerifyEvent } from "@/lib/permissions/guards";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx) {
    return new NextResponse(null, { status: 404 });
  }

  const { eventId } = await params;
  if (!canVerifyEvent(ctx, eventId)) {
    return new NextResponse(null, { status: 404 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  });
  if (!event) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({ title: event.title });
}
