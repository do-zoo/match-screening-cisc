import {
  InvoiceAdjustmentStatus,
  TicketRole,
  type TicketPriceType,
} from "@prisma/client";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { RegistrationDetailShell } from "@/components/admin/registration-detail-panels/registration-detail-shell";
import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import {
  buildRegistrationDetailPath,
  defaultRegistrationDetailTab,
  parseRegistrationDetailTab,
} from "@/lib/admin/event-registration-detail-tab";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
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

function mergeUploadsForDetail<T extends { id: string; createdAt: Date }>(
  ticketRole: TicketRole,
  primaryUploads: T[] | undefined,
  ownUploads: T[],
): T[] {
  if (ticketRole !== TicketRole.partner || !primaryUploads?.length) {
    return ownUploads;
  }
  const byId = new Map(primaryUploads.map((u) => [u.id, u]));
  for (const u of ownUploads) {
    byId.set(u.id, u);
  }
  return [...byId.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

function syntheticTicketRows(opts: {
  primary: {
    id: string;
    contactName: string;
    contactWhatsapp: string;
    claimedMemberNumber: string | null;
    ticketPriceType: TicketPriceType;
    menu: MenuSnap;
  };
  partners: Array<{
    id: string;
    contactName: string;
    contactWhatsapp: string;
    claimedMemberNumber: string | null;
    ticketPriceType: TicketPriceType;
    menu: MenuSnap;
  }>;
}): DetailRegistration["tickets"] {
  const { primary, partners } = opts;
  const base = (
    id: string,
    role: TicketRole,
    row: (typeof opts)["primary"],
  ) => ({
    id,
    role,
    fullName: row.contactName,
    whatsapp: row.contactWhatsapp,
    memberNumber: row.claimedMemberNumber,
    ticketPriceType: row.ticketPriceType,
    menuSelections: [
      { menuItem: { name: row.menu.name, price: row.menu.price } },
    ],
  });

  const out = [base(primary.id, TicketRole.primary, primary)];
  for (const pr of partners) {
    out.push(base(pr.id, TicketRole.partner, pr));
  }
  return out;
}

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

function tabParamMissing(param: string | string[] | undefined): boolean {
  return (
    param === undefined ||
    param === "" ||
    (Array.isArray(param) && (param.length === 0 || param[0] === ""))
  );
}

export default async function AdminEventRegistrantsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; registrationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId, registrationId } = await params;
  const sp = (await searchParams) ?? {};

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
      ticketPriceApplied: true,
      mandatoryMenuPriceApplied: true,
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
          uploads: {
            orderBy: { createdAt: "asc" as const },
          },
        },
      },
      partnerRegistrations: {
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

  const hasUnpaidAdjustment = registration.adjustments.some(
    (a) => a.status === InvoiceAdjustmentStatus.unpaid,
  );

  const fallbackTab = defaultRegistrationDetailTab({
    status: registration.status,
    hasUnpaidAdjustment,
  });

  if (tabParamMissing(sp.tab)) {
    redirect(buildRegistrationDetailPath(eventId, registrationId, fallbackTab));
  }

  const rawTab = firstString(sp.tab);
  const parsedTab = parseRegistrationDetailTab(rawTab);
  if (parsedTab === null) {
    redirect(buildRegistrationDetailPath(eventId, registrationId, fallbackTab));
  }

  const detailTab = parsedTab;

  const menuSnap = (m: { name: string; price: number }): MenuSnap => ({
    name: m.name,
    price: m.price,
  });

  let ticketsForDetail: DetailRegistration["tickets"];
  if (registration.ticketRole === TicketRole.primary) {
    const partners = registration.partnerRegistrations.map((pr) => ({
      id: pr.id,
      contactName: pr.contactName,
      contactWhatsapp: pr.contactWhatsapp,
      claimedMemberNumber: pr.claimedMemberNumber,
      ticketPriceType: pr.ticketPriceType,
      menu: menuSnap(pr.mandatoryMenuItem),
    }));
    ticketsForDetail = syntheticTicketRows({
      primary: {
        id: registration.id,
        contactName: registration.contactName,
        contactWhatsapp: registration.contactWhatsapp,
        claimedMemberNumber: registration.claimedMemberNumber,
        ticketPriceType: registration.ticketPriceType,
        menu: menuSnap(registration.mandatoryMenuItem),
      },
      partners,
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
        partners: [],
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
        partners: [
          {
            id: registration.id,
            contactName: registration.contactName,
            contactWhatsapp: registration.contactWhatsapp,
            claimedMemberNumber: registration.claimedMemberNumber,
            ticketPriceType: registration.ticketPriceType,
            menu: menuSnap(registration.mandatoryMenuItem),
          },
        ],
      });
    }
  }

  const {
    primaryRegistration,
    partnerRegistrations,
    mandatoryMenuItem,
    event: prismaEvent,
    uploads: ownUploads,
    ...registrationRest
  } = registration;

  const uploadsMerged = mergeUploadsForDetail(
    registration.ticketRole,
    primaryRegistration?.uploads,
    ownUploads,
  );

  const registrationForDetail: DetailRegistration = {
    ...registrationRest,
    uploads: uploadsMerged,
    ticketPriceApplied: registration.ticketPriceApplied,
    mandatoryMenuPriceApplied: registration.mandatoryMenuPriceApplied,
    mandatoryMenuItemName: mandatoryMenuItem.name,
    relationsPrimary: primaryRegistration
      ? {
          id: primaryRegistration.id,
          contactName: primaryRegistration.contactName,
        }
      : null,
    relationsPartners: partnerRegistrations.map((p) => ({
      id: p.id,
      contactName: p.contactName,
    })),
    event: {
      title: prismaEvent.title,
      venueName: prismaEvent.venue.name,
      kickOffAt: prismaEvent.kickOffAt,
      ticketMemberPrice: prismaEvent.ticketMemberPrice,
      ticketNonMemberPrice: prismaEvent.ticketNonMemberPrice,
      menuItems: flattenedMenuRowsFromEventVenueLinks(
        prismaEvent.eventVenueMenuItems,
      ),
      bankAccount: prismaEvent.bankAccount,
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
        claimedManagementPublicCode: registration.claimedManagementPublicCode,
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
      <RegistrationDetailShell
        eventId={eventId}
        tab={detailTab}
        registration={registrationForDetail}
        ticketContext={ticketContext}
        waBodies={waBodies}
        showOperasiBadge={hasUnpaidAdjustment}
      />
    </main>
  );
}
