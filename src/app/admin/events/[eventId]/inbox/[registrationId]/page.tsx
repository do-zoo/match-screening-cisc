import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RegistrationDetail } from "@/components/admin/registration-detail";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { prisma } from "@/lib/db/prisma";
import { flattenedMenuRowsFromEventVenueLinks } from "@/lib/events/flatten-event-venue-menu";
import { canVerifyEvent } from "@/lib/permissions/guards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  });
  return { title: event ? `Registrasi · ${event.title}` : "Registrasi" };
}
import type { TicketContextVm } from "@/lib/registrations/admin-ticket-context";
import { loadTicketContextVm } from "@/lib/registrations/load-admin-ticket-context";
import { loadClubWaTemplateBodies } from "@/lib/wa-templates/load-club-wa-templates";

export default async function AdminEventInboxDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; registrationId: string }>;
}) {
  const { eventId, registrationId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-10 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Detail pendaftar
        </h1>
        <div className="rounded-lg border border-dashed bg-card p-6 text-sm">
          Missing AdminProfile
        </div>
      </main>
    );
  }

  if (!canVerifyEvent(ctx, eventId)) notFound();

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, eventId },
    select: {
      id: true,
      createdAt: true,
      contactName: true,
      contactWhatsapp: true,
      claimedMemberNumber: true,
      primaryManagementMemberId: true,
      claimedManagementPublicCode: true,
      computedTotalAtSubmit: true,
      ticketMemberPriceApplied: true,
      ticketNonMemberPriceApplied: true,
      status: true,
      attendanceStatus: true,
      memberValidation: true,
      rejectionReason: true,
      paymentIssueReason: true,
      event: {
        select: {
          title: true,
          startAt: true,
          menuMode: true,
          venue: { select: { name: true } },
          eventVenueMenuItems: {
            include: { venueMenuItem: true },
          },
          bankAccount: {
            select: { bankName: true, accountNumber: true, accountName: true },
          },
        },
      },
      tickets: {
        orderBy: { createdAt: "asc" as const },
        include: {
          menuSelections: {
            include: { menuItem: { select: { name: true, price: true } } },
          },
        },
      },
      uploads: { orderBy: { createdAt: "asc" as const } },
      adjustments: {
        orderBy: { createdAt: "asc" as const },
        include: {
          uploads: {
            select: { id: true, blobUrl: true, bytes: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!registration) notFound();

  const registrationForDetail = {
    ...registration,
    event: {
      title: registration.event.title,
      venueName: registration.event.venue.name,
      startAt: registration.event.startAt,
      menuMode: registration.event.menuMode,
      menuItems: flattenedMenuRowsFromEventVenueLinks(
        registration.event.eventVenueMenuItems,
      ),
      bankAccount: registration.event.bankAccount,
    },
  };

  let ticketContext: TicketContextVm;
  try {
    ticketContext = await loadTicketContextVm({
      eventId,
      registration: {
        id: registration.id,
        claimedMemberNumber: registration.claimedMemberNumber,
        primaryManagementMemberId: registration.primaryManagementMemberId,
        claimedManagementPublicCode:
          registration.claimedManagementPublicCode,
        tickets: registration.tickets.map((t) => ({
          role: t.role,
          fullName: t.fullName,
          whatsapp: t.whatsapp,
          memberNumber: t.memberNumber,
          ticketPriceType: t.ticketPriceType,
        })),
      },
    });
  } catch {
    ticketContext = {
      kind: "error",
      message: "Tidak dapat memuat konteks kursi.",
    };
  }

  const waBodies = await loadClubWaTemplateBodies();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-10 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Detail pendaftar
          </h1>
          <p className="text-sm text-muted-foreground">{registrationForDetail.event.title}</p>
        </div>
        <Link
          href={`/admin/events/${eventId}/inbox`}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Kembali ke inbox
        </Link>
      </header>

      <RegistrationDetail
        eventId={eventId}
        registration={registrationForDetail}
        ticketContext={ticketContext}
        waBodies={waBodies}
      />
    </main>
  );
}

