import Link from "next/link";
import { notFound } from "next/navigation";

import { EventAdminForm } from "@/components/admin/forms/event-admin-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resolveCommitteeTicketDefaults } from "@/lib/events/event-admin-defaults";
import type { EventIntegritySnapshot } from "@/lib/events/event-edit-guards";
import type { AdminEventUpsertInput } from "@/lib/forms/admin-event-form-schema";
import { hasOperationalOwnerParity, canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";
import { EventDeletePanel } from "@/components/admin/event-delete-panel";
import {
  loadPicAdminProfileOptionsForEvents,
  loadPicAdminToMemberLinkMap,
} from "@/lib/admin/pic-options-for-event";
import { cn } from "@/lib/utils";

export default async function AdminEditEventPage({
  params,
}: Readonly<{
  params: Promise<{ eventId: string }>;
}>) {
  const { eventId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan acara</h1>
        <Alert variant="destructive">
          <AlertTitle>Profil admin belum ada</AlertTitle>
          <AlertDescription>
            Akun Anda belum dikaitkan ke AdminProfile. Hubungi Owner untuk aktivasi akses PIC.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      menuItems: { orderBy: { sortOrder: "asc" } },
      helpers: { select: { memberId: true } },
      _count: { select: { registrations: true } },
    },
  });

  if (!event) {
    notFound();
  }

  const [picOptions, banks, helperMembers, picMemberLinkByAdminId] =
    await Promise.all([
      loadPicAdminProfileOptionsForEvents(),
      prisma.picBankAccount.findMany({
        where: { isActive: true },
        orderBy: { bankName: "asc" },
        select: {
          id: true,
          ownerAdminProfileId: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
        },
      }),
      prisma.masterMember.findMany({
        where: { isActive: true },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, memberNumber: true },
      }),
      loadPicAdminToMemberLinkMap(),
    ]);

  const banksByPic: Record<
    string,
    Array<{ id: string; label: string }>
  > = {};
  for (const b of banks) {
    const list = banksByPic[b.ownerAdminProfileId] ?? [];
    list.push({
      id: b.id,
      label: `${b.bankName} — ${b.accountNumber} (${b.accountName})`,
    });
    banksByPic[b.ownerAdminProfileId] = list;
  }

  const helperAdminOptions = helperMembers.map((m) => ({
    id: m.id,
    label: `${m.fullName} (${m.memberNumber})`,
  }));

  const defaults: AdminEventUpsertInput = {
    title: event.title,
    summary: event.summary,
    descriptionHtml: event.description,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    startAtIso: event.startAt.toISOString(),
    endAtIso: event.endAt.toISOString(),
    registrationCapacity: event.registrationCapacity,
    registrationManualClosed: event.registrationManualClosed,
    status: event.status,
    menuMode: event.menuMode,
    menuSelection: event.menuSelection,
    voucherPriceIdr: event.voucherPrice,
    pricingSource: event.pricingSource,
    ticketMemberPrice: event.ticketMemberPrice,
    ticketNonMemberPrice: event.ticketNonMemberPrice,
    picAdminProfileId: event.picAdminProfileId,
    bankAccountId: event.bankAccountId,
    helperMasterMemberIds: event.helpers.map((h) => h.memberId),
    menuItems: event.menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      priceIdr: m.price,
      sortOrder: m.sortOrder,
      voucherEligible: m.voucherEligible,
    })),
    acknowledgeSensitiveChanges: false,
  };

  const persistedIntegrity: EventIntegritySnapshot = {
    slug: event.slug,
    menuMode: event.menuMode,
    menuSelection: event.menuSelection,
    ticketMemberPrice: event.ticketMemberPrice,
    ticketNonMemberPrice: event.ticketNonMemberPrice,
    voucherPrice: event.voucherPrice,
    pricingSource: event.pricingSource,
    picAdminProfileId: event.picAdminProfileId,
    bankAccountId: event.bankAccountId,
  };

  const committeeDefaults = await resolveCommitteeTicketDefaults(prisma);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pb-16 pt-8 lg:pt-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/events"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-0")}
        >
          ← Kembali ke daftar acara
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan acara</h1>
        <p className="text-muted-foreground text-sm font-mono">slug · {event.slug}</p>
        {event._count.registrations > 0 ? (
          <p className="text-amber-800 text-sm dark:text-amber-200">
            Ada {event._count.registrations} registrasi — mode menu dan slug dikunci oleh sistem.
          </p>
        ) : null}
      </header>

      <EventAdminForm
        mode="edit"
        eventId={eventId}
        committeeDefaults={committeeDefaults}
        defaults={defaults}
        registrationCount={event._count.registrations}
        persistedIntegrity={persistedIntegrity}
        picOptions={picOptions}
        banksByPic={banksByPic}
        helperAdminOptions={helperAdminOptions}
        picMemberLinkByAdminId={picMemberLinkByAdminId}
      />
      {canManageCommitteeAdvancedSettings(ctx.role) ? (
        <EventDeletePanel
          eventId={eventId}
          eventTitle={event.title}
          registrationCount={event._count.registrations}
        />
      ) : null}
    </main>
  );
}
