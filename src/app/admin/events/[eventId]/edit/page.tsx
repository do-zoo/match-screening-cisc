import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventDeletePanel } from "@/components/admin/event-delete-panel";
import { EventAdminForm } from "@/components/admin/forms/event-admin-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { loadPicAdminProfileOptionsForEvents } from "@/lib/admin/pic-options-for-event";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { EventIntegritySnapshot } from "@/lib/events/event-edit-guards";
import type { AdminEventUpsertInput } from "@/lib/forms/admin-event-form-schema";
import {
  canManageCommitteeAdvancedSettings,
  hasOperationalOwnerParity,
} from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

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
  return { title: event ? `Edit · ${event.title}` : "Edit Acara" };
}

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
        <h1 className="text-2xl font-semibold tracking-tight">
          Pengaturan acara
        </h1>
        <Alert variant="destructive">
          <AlertTitle>Profil admin belum ada</AlertTitle>
          <AlertDescription>
            Akun Anda belum dikaitkan ke AdminProfile. Hubungi Owner untuk
            aktivasi akses PIC.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const [event, venuesRaw] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        eventVenueMenuItems: { include: { venueMenuItem: true } },
        helpers: { select: { adminProfileId: true } },
        _count: { select: { registrations: true } },
      },
    }),
    prisma.venue.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        menuItems: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  if (!event) {
    notFound();
  }

  const venueOptions = venuesRaw.map((v) => ({
    id: v.id,
    name: v.name,
    menuItems: v.menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      price: m.price,
      sortOrder: m.sortOrder,
    })),
  }));

  const [picOptions, banks] = await Promise.all([
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
  ]);

  const banksByPic: Record<string, Array<{ id: string; label: string }>> = {};
  for (const b of banks) {
    const list = banksByPic[b.ownerAdminProfileId] ?? [];
    list.push({
      id: b.id,
      label: `${b.bankName} — ${b.accountNumber} (${b.accountName})`,
    });
    banksByPic[b.ownerAdminProfileId] = list;
  }

  const helperAdminOptions = picOptions;

  const sortedEventLinks = [...event.eventVenueMenuItems].sort(
    (a, b) =>
      (a.sortOrder ?? a.venueMenuItem.sortOrder) -
      (b.sortOrder ?? b.venueMenuItem.sortOrder),
  );

  const persistedLinkedDraft = sortedEventLinks.map((x, idx) => ({
    venueMenuItemId: x.venueMenuItemId,
    sortOrder: x.sortOrder ?? idx,
  }));

  const venueForEvent = venueOptions.find((v) => v.id === event.venueId);
  const fullCatalogLinked =
    venueForEvent != null
      ? [...venueForEvent.menuItems]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((m, idx) => ({
            venueMenuItemId: m.id,
            sortOrder: idx,
          }))
      : [];

  const linkedVenueMenuItems =
    event._count.registrations === 0 && fullCatalogLinked.length > 0
      ? fullCatalogLinked
      : persistedLinkedDraft;

  const defaults: AdminEventUpsertInput = {
    title: event.title,
    summary: event.summary,
    descriptionHtml: event.description,
    venueId: event.venueId,
    linkedVenueMenuItems,
    openRegistrationAtIso: event.openRegistrationAt.toISOString(),
    closeRegistrationAtIso: event.closeRegistrationAt.toISOString(),
    openGateAtIso: event.openGateAt.toISOString(),
    kickOffAtIso: event.kickOffAt.toISOString(),
    mandatoryMenuItemIds: [...event.mandatoryMenuItemIds],
    registrationCapacity: event.registrationCapacity,
    registrationManualClosed: event.registrationManualClosed,
    status: event.status,
    ticketMemberPrice: event.ticketMemberPrice,
    ticketNonMemberPrice: event.ticketNonMemberPrice,
    picAdminProfileId: event.picAdminProfileId,
    bankAccountId: event.bankAccountId,
    helperAdminProfileIds: event.helpers.map((h) => h.adminProfileId),
    acknowledgeSensitiveChanges: false,
  };

  const persistedIntegrity: EventIntegritySnapshot = {
    slug: event.slug,
    venueId: event.venueId,
    mandatoryMenuItemIds: [...event.mandatoryMenuItemIds],
    ticketMemberPrice: event.ticketMemberPrice,
    ticketNonMemberPrice: event.ticketNonMemberPrice,
    picAdminProfileId: event.picAdminProfileId,
    bankAccountId: event.bankAccountId,
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-16 pt-8 lg:pt-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/events"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit px-0",
          )}
        >
          ← Kembali ke daftar acara
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pengaturan acara
        </h1>
        {event._count.registrations > 0 ? (
          <p className="text-amber-800 text-sm dark:text-amber-200">
            Ada {event._count.registrations} registrasi
          </p>
        ) : null}
      </header>

      <EventAdminForm
        mode="edit"
        eventId={eventId}
        defaults={defaults}
        registrationCount={event._count.registrations}
        persistedIntegrity={persistedIntegrity}
        persistedCoverUrl={event.coverBlobUrl}
        picOptions={picOptions}
        banksByPic={banksByPic}
        helperAdminOptions={helperAdminOptions}
        venueOptions={venueOptions}
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
