import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Buat Acara" };

import { EventAdminForm } from "@/components/admin/forms/event-admin-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  loadPicAdminProfileOptionsForEvents,
  loadPicAdminToMemberLinkMap,
} from "@/lib/admin/pic-options-for-event";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resolveCommitteeTicketDefaults } from "@/lib/events/event-admin-defaults";
import type { AdminEventUpsertInput } from "@/lib/forms/admin-event-form-schema";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

export default async function AdminNewEventPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Buat acara</h1>
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

  const committeeDefaults = await resolveCommitteeTicketDefaults(prisma);
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

  const firstPicId = picOptions[0]?.id;
  const firstBankId =
    firstPicId && banksByPic[firstPicId]?.[0]?.id
      ? banksByPic[firstPicId]![0]!.id
      : "";

  const now = new Date();
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const defaults: AdminEventUpsertInput = {
    title: "",
    summary: "",
    descriptionHtml: "<p></p>",
    venueName: "",
    venueAddress: "",
    startAtIso: now.toISOString(),
    endAtIso: inOneWeek.toISOString(),
    registrationCapacity: null,
    registrationManualClosed: false,
    status: "draft",
    menuMode: "PRESELECT",
    menuSelection: "SINGLE",
    voucherPriceIdr: null,
    pricingSource: "global_default",
    ticketMemberPrice: committeeDefaults.ticketMemberPrice,
    ticketNonMemberPrice: committeeDefaults.ticketNonMemberPrice,
    picAdminProfileId: firstPicId ?? "",
    bankAccountId: firstBankId,
    helperMasterMemberIds: [],
    menuItems: [
      {
        name: "Contoh menu",
        priceIdr: 0,
        sortOrder: 1,
        voucherEligible: true,
      },
    ],
  };

  if (!firstPicId || !firstBankId) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
        <header className="flex flex-col gap-2">
          <Link
            href="/admin/events"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-0")}
          >
            ← Kembali ke daftar acara
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Buat acara</h1>
        </header>
        <Alert>
          <AlertTitle>Belum siap membuat acara</AlertTitle>
          <AlertDescription>
            Perlu minimal satu admin (bukan Viewer) dengan profil terdaftar <strong>dan</strong> setidaknya
            satu rekening PIC aktif milik admin tersebut. Pastikan rekening bank dipasangkan ke profil admin
            di pengaturan komite, lalu coba lagi.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/events"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-0")}
        >
          ← Kembali ke daftar acara
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Buat acara</h1>
        <p className="text-muted-foreground text-sm">
          Isi detail acara, menu, PIC, dan unggah sampul. Slug URL dibuat otomatis dari judul.
        </p>
      </header>

      <EventAdminForm
        mode="create"
        committeeDefaults={committeeDefaults}
        defaults={defaults}
        picOptions={picOptions}
        banksByPic={banksByPic}
        helperAdminOptions={helperAdminOptions}
        picMemberLinkByAdminId={picMemberLinkByAdminId}
      />
    </main>
  );
}
