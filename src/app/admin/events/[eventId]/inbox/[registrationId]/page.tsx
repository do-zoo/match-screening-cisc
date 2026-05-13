import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketRole, type TicketPriceType } from "@prisma/client";

import {
  RegistrationDetail,
  type DetailRegistration,
} from "@/components/admin/registration-detail";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { prisma } from "@/lib/db/prisma";
import { flattenedMenuRowsFromEventVenueLinks } from "@/lib/events/flatten-event-venue-menu";
import { canVerifyEvent } from "@/lib/permissions/guards";
import type { TicketContextVm } from "@/lib/registrations/admin-ticket-context";
import { loadTicketContextVm } from "@/lib/registrations/load-admin-ticket-context";
import { loadClubWaTemplateBodies } from "@/lib/wa-templates/load-club-wa-templates";

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

type MenuSnap = { name: string; price: number };

function syntheticTicketRows(opts: {
  primary: {
    id: string;
    contactName: string;
    contactWhatsapp: string;
    claimedMemberNumber: string | null;
    ticketPriceType: TicketPriceType;
    menu: MenuSnap;
  };
  partner: {
    id: string;
    contactName: string;
    contactWhatsapp: string;
    claimedMemberNumber: string | null;
    ticketPriceType: TicketPriceType;
    menu: MenuSnap;
  } | null;
}): DetailRegistration["tickets"] {
  const { primary, partner } = opts;
  const base = (id: string, role: TicketRole, row: typeof primary) => ({
    id,
    role,
    fullName: row.contactName,
    whatsapp: row.contactWhatsapp,
    memberNumber: row.claimedMemberNumber,
    ticketPriceType: row.ticketPriceType,
    voucherRedeemedMenuItemId: null as string | null,
    voucherRedeemedAt: null as Date | null,
    menuSelections: [
      { menuItem: { name: row.menu.name, price: row.menu.price } },
    ],
  });

  const out = [base(primary.id, TicketRole.primary, primary)];
  if (partner) {
    out.push(base(partner.id, TicketRole.partner, partner));
  }
  return out;
}

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
      status: true,
      attendanceStatus: true,
      memberValidation: true,
      rejectionReason: true,
      paymentIssueReason: true,
      ticketRole: true,
      ticketPriceType: true,
      primaryRegistrationId: true,
      primaryRegistration: {
        select: {
          id: true,
          contactName: true,
          contactWhatsapp: true,
          claimedMemberNumber: true,
          ticketPriceType: true,
          mandatoryMenuItem: { select: { name: true, price: true } },
        },
      },
      partnerRegistrations: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          contactName: true,
          contactWhatsapp: true,
          claimedMemberNumber: true,
          ticketPriceType: true,
          mandatoryMenuItem: { select: { name: true, price: true } },
        },
      },
      mandatoryMenuItem: { select: { name: true, price: true } },
      event: {
        select: {
          title: true,
          kickOffAt: true,
          ticketMemberPrice: true,
          ticketNonMemberPrice: true,
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

  const menuSnap = (m: { name: string; price: number }): MenuSnap => ({
    name: m.name,
    price: m.price,
  });

  let ticketsForDetail: DetailRegistration["tickets"] = registration.tickets;
  if (ticketsForDetail.length === 0) {
    if (registration.ticketRole === TicketRole.primary) {
      const pr = registration.partnerRegistrations[0];
      ticketsForDetail = syntheticTicketRows({
        primary: {
          id: registration.id,
          contactName: registration.contactName,
          contactWhatsapp: registration.contactWhatsapp,
          claimedMemberNumber: registration.claimedMemberNumber,
          ticketPriceType: registration.ticketPriceType,
          menu: menuSnap(registration.mandatoryMenuItem),
        },
        partner: pr
          ? {
              id: pr.id,
              contactName: pr.contactName,
              contactWhatsapp: pr.contactWhatsapp,
              claimedMemberNumber: pr.claimedMemberNumber,
              ticketPriceType: pr.ticketPriceType,
              menu: menuSnap(pr.mandatoryMenuItem),
            }
          : null,
      });
    } else {
      const p = registration.primaryRegistration;
      if (!p) {
        ticketsForDetail = syntheticTicketRows({
          primary: {
            id: registration.id,
            contactName: registration.contactName,
            contactWhatsapp: registration.contactWhatsapp,
            claimedMemberNumber: registration.claimedMemberNumber,
            ticketPriceType: registration.ticketPriceType,
            menu: menuSnap(registration.mandatoryMenuItem),
          },
          partner: null,
        });
      } else {
        ticketsForDetail = syntheticTicketRows({
          primary: {
            id: p.id,
            contactName: p.contactName,
            contactWhatsapp: p.contactWhatsapp,
            claimedMemberNumber: p.claimedMemberNumber,
            ticketPriceType: p.ticketPriceType,
            menu: menuSnap(p.mandatoryMenuItem),
          },
          partner: {
            id: registration.id,
            contactName: registration.contactName,
            contactWhatsapp: registration.contactWhatsapp,
            claimedMemberNumber: registration.claimedMemberNumber,
            ticketPriceType: registration.ticketPriceType,
            menu: menuSnap(registration.mandatoryMenuItem),
          },
        });
      }
    }
  }

  const registrationForDetail = {
    ...registration,
    event: {
      title: registration.event.title,
      venueName: registration.event.venue.name,
      kickOffAt: registration.event.kickOffAt,
      ticketMemberPrice: registration.event.ticketMemberPrice,
      ticketNonMemberPrice: registration.event.ticketNonMemberPrice,
      menuItems: flattenedMenuRowsFromEventVenueLinks(
        registration.event.eventVenueMenuItems,
      ),
      bankAccount: registration.event.bankAccount,
    },
    tickets: ticketsForDetail,
  };

  let ticketContext: TicketContextVm;
  try {
    const ctxTickets = ticketsForDetail.map((t) => ({
      role: t.role,
      fullName: t.fullName,
      whatsapp: t.whatsapp,
      memberNumber: t.memberNumber,
      ticketPriceType: t.ticketPriceType,
    }));

    ticketContext = await loadTicketContextVm({
      eventId,
      registration: {
        id: registration.id,
        claimedMemberNumber: registration.claimedMemberNumber,
        primaryManagementMemberId: registration.primaryManagementMemberId,
        claimedManagementPublicCode:
          registration.claimedManagementPublicCode,
        tickets: ctxTickets,
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
          <p className="text-sm text-muted-foreground">
            {registrationForDetail.event.title}
          </p>
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
