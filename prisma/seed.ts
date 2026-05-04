import "dotenv/config";

import {
  AdminRole,
  EventStatus,
  MenuMode,
  MenuSelection,
  PricingSource,
} from "@prisma/client";

/** Same Neon + `db.localtest.me` proxy setup as the app (`scripts/bootstrap-admin` pattern). */
import { prisma } from "@/lib/db/prisma";

/** Kombinasi isActive × isManagementMember — untuk variasi direktori (tanpa PIC di member). */
type MasterMemberSeed = {
  memberNumber: string;
  fullName: string;
  isActive: boolean;
  isManagementMember: boolean;
  whatsapp?: string | null;
  /** Jika diisi, buat ManagementMember dengan publicCode ini dan tautkan ke MasterMember. */
  managementPublicCode?: string;
};

const MASTER_MEMBER_SEEDS: MasterMemberSeed[] = [
  {
    memberNumber: "CISC-DEMO-PIC-1",
    fullName: "Demo PIC Pengurus",
    isActive: true,
    isManagementMember: true,
    whatsapp: "+6281380013800",
    managementPublicCode: "DEMO-PIC",
  },
  {
    memberNumber: "CISC-SEED-110",
    fullName: "Seed · aktif · pengurus",
    isActive: true,
    isManagementMember: true,
    managementPublicCode: "SEED-A",
  },
  {
    memberNumber: "CISC-SEED-101",
    fullName: "Seed · aktif · anggota",
    isActive: true,
    isManagementMember: false,
  },
  {
    memberNumber: "CISC-SEED-100",
    fullName: "Seed · aktif · anggota biasa",
    isActive: true,
    isManagementMember: false,
  },
  {
    memberNumber: "CISC-SEED-011",
    fullName: "Seed · nonaktif · pengurus",
    isActive: false,
    isManagementMember: true,
    managementPublicCode: "SEED-B",
  },
  {
    memberNumber: "CISC-SEED-010",
    fullName: "Seed · nonaktif · pengurus",
    isActive: false,
    isManagementMember: true,
    managementPublicCode: "SEED-C",
  },
  {
    memberNumber: "CISC-SEED-001",
    fullName: "Seed · nonaktif · anggota",
    isActive: false,
    isManagementMember: false,
  },
  {
    memberNumber: "CISC-SEED-000",
    fullName: "Seed · nonaktif · anggota biasa",
    isActive: false,
    isManagementMember: false,
  },
];

async function main() {
  for (const row of MASTER_MEMBER_SEEDS) {
    const whatsapp =
      row.whatsapp === undefined ? undefined : (row.whatsapp ?? null);
    await prisma.masterMember.upsert({
      where: { memberNumber: row.memberNumber },
      update: {
        fullName: row.fullName,
        isActive: row.isActive,
        isManagementMember: row.isManagementMember,
        ...(whatsapp !== undefined ? { whatsapp } : {}),
      },
      create: {
        memberNumber: row.memberNumber,
        fullName: row.fullName,
        isActive: row.isActive,
        isManagementMember: row.isManagementMember,
        ...(whatsapp !== undefined ? { whatsapp } : {}),
      },
    });
  }

  // Upsert ManagementMember records for every seed that has a publicCode.
  // Each is linked to its MasterMember via masterMemberId.
  for (const row of MASTER_MEMBER_SEEDS) {
    if (!row.managementPublicCode) continue;
    const master = await prisma.masterMember.findUnique({
      where: { memberNumber: row.memberNumber },
      select: { id: true },
    });
    if (!master) continue;
    await prisma.managementMember.upsert({
      where: { publicCode: row.managementPublicCode },
      update: { fullName: row.fullName, masterMemberId: master.id },
      create: {
        publicCode: row.managementPublicCode,
        fullName: row.fullName,
        masterMemberId: master.id,
        ...(row.whatsapp ? { whatsapp: row.whatsapp } : {}),
      },
    });
  }

  const ownerProfile = await prisma.adminProfile.findFirst({
    where: { role: AdminRole.Owner },
    orderBy: { createdAt: "asc" },
  });

  if (!ownerProfile) {
    console.warn(
      "Seed: lewati acara demo — tidak ada AdminProfile Owner. Jalankan bootstrap admin terlebih dahulu.",
    );
    return;
  }

  // Link owner admin profile to the DEMO-PIC ManagementMember if not already linked.
  if (!ownerProfile.managementMemberId) {
    const demoPicMember = await prisma.managementMember.findUnique({
      where: { publicCode: "DEMO-PIC" },
      select: { id: true },
    });
    if (demoPicMember) {
      await prisma.adminProfile.update({
        where: { id: ownerProfile.id },
        data: { managementMemberId: demoPicMember.id },
      });
    }
  }

  const existingBank = await prisma.picBankAccount.findFirst({
    where: {
      ownerAdminProfileId: ownerProfile.id,
      accountNumber: "1234567890",
    },
  });
  const bank = existingBank
    ? await prisma.picBankAccount.update({
        where: { id: existingBank.id },
        data: {
          bankName: "BCA",
          accountName: "Demo CISC Tangsel",
          isActive: true,
        },
      })
    : await prisma.picBankAccount.create({
        data: {
          ownerAdminProfileId: ownerProfile.id,
          bankName: "BCA",
          accountNumber: "1234567890",
          accountName: "Demo CISC Tangsel",
          isActive: true,
        },
      });

  const DEMO_VENUE_ID = "cm_seed_venue_demo_final";
  const CATALOG_VENUE_ID = "cm_seed_venue_catalog_wide";

  const demoVenue = await prisma.venue.upsert({
    where: { id: DEMO_VENUE_ID },
    update: {
      name: "Venue Demo · Nobar",
      address: "Jl. Demo No. 1, Tangerang Selatan",
      notes:
        "Contoh venue untuk acara nobar demo. Dipakai `demo-final-ucl-2026` dengan subset dua menu.",
      isActive: true,
    },
    create: {
      id: DEMO_VENUE_ID,
      name: "Venue Demo · Nobar",
      address: "Jl. Demo No. 1, Tangerang Selatan",
      notes:
        "Contoh venue untuk acara nobar demo. Dipakai `demo-final-ucl-2026` dengan subset dua menu.",
      isActive: true,
    },
  });

  const catalogVenue = await prisma.venue.upsert({
    where: { id: CATALOG_VENUE_ID },
    update: {
      name: "Venue Demo · Katalog luas",
      address: "Jl. Contoh No. 99 (tanpa acara)",
      notes:
        "Venue kedua untuk uji CRUD katalog: banyak item menu, belum ditautkan ke acara mana pun.",
      isActive: true,
    },
    create: {
      id: CATALOG_VENUE_ID,
      name: "Venue Demo · Katalog luas",
      address: "Jl. Contoh No. 99 (tanpa acara)",
      notes:
        "Venue kedua untuk uji CRUD katalog: banyak item menu, belum ditautkan ke acara mana pun.",
      isActive: true,
    },
  });

  // Venue menu rows are recreated below; dependents use onDelete Restrict, so strip them first
  // (e.g. EventVenueMenuItem from seeded voucher event, TicketMenuSelection from test regs).
  const seededVenueMenuIds = await prisma.venueMenuItem.findMany({
    where: { venueId: { in: [demoVenue.id, catalogVenue.id] } },
    select: { id: true },
  });
  const seededMenuIds = seededVenueMenuIds.map((r) => r.id);
  if (seededMenuIds.length > 0) {
    await prisma.ticketMenuSelection.deleteMany({
      where: { menuItemId: { in: seededMenuIds } },
    });
    await prisma.eventVenueMenuItem.deleteMany({
      where: { venueMenuItemId: { in: seededMenuIds } },
    });
  }

  await prisma.venueMenuItem.deleteMany({
    where: { venueId: demoVenue.id },
  });
  await prisma.venueMenuItem.deleteMany({
    where: { venueId: catalogVenue.id },
  });

  const [vmBurger, vmNasi] = await Promise.all([
    prisma.venueMenuItem.create({
      data: {
        venueId: demoVenue.id,
        name: "Paket Burger",
        price: 55_000,
        sortOrder: 1,
        voucherEligible: true,
      },
    }),
    prisma.venueMenuItem.create({
      data: {
        venueId: demoVenue.id,
        name: "Paket Nasi",
        price: 50_000,
        sortOrder: 2,
        voucherEligible: true,
      },
    }),
  ]);

  await prisma.venueMenuItem.createMany({
    data: [
      {
        venueId: catalogVenue.id,
        name: "Snack ringan",
        price: 35_000,
        sortOrder: 1,
        voucherEligible: true,
      },
      {
        venueId: catalogVenue.id,
        name: "Minuman",
        price: 25_000,
        sortOrder: 2,
        voucherEligible: true,
      },
      {
        venueId: catalogVenue.id,
        name: "Paket premium",
        price: 95_000,
        sortOrder: 3,
        voucherEligible: false,
      },
      {
        venueId: catalogVenue.id,
        name: "Dessert",
        price: 40_000,
        sortOrder: 4,
        voucherEligible: true,
      },
    ],
  });

  const eventSummary =
    "Nobar final bersama komunitas Chelsea FC Indonesia — daftar, pilih menu, unggah bukti transfer.";
  const eventDescription =
    "<p>Acara demo untuk alur pendaftaran. <strong>Perbarui deskripsi ini</strong> lewat admin ketika editor WYSIWYG tersedia.</p><p>Pastikan pembayaran menggunakan rekening yang tertera di formulir.</p>";

  const event = await prisma.event.upsert({
    where: { slug: "demo-final-ucl-2026" },
    update: {
      title: "Demo — Final Watch Party",
      bankAccountId: bank.id,
      picAdminProfileId: ownerProfile.id,
      venueId: demoVenue.id,
      summary: eventSummary,
      description: eventDescription,
      startAt: new Date("2026-05-20T18:30:00+07:00"),
      endAt: new Date("2026-05-20T23:00:00+07:00"),
      registrationManualClosed: false,
      registrationCapacity: null,
      status: EventStatus.active,
      ticketMemberPrice: 125_000,
      ticketNonMemberPrice: 175_000,
      pricingSource: PricingSource.global_default,
      menuMode: MenuMode.PRESELECT,
      menuSelection: MenuSelection.SINGLE,
      voucherPrice: null,
      coverBlobUrl:
        "https://placehold.co/1200x630/001489/ffffff/png?text=Demo+Watch+Party",
      coverBlobPath: "__seed__/demo-final-ucl-2026/cover.webp",
    },
    create: {
      slug: "demo-final-ucl-2026",
      title: "Demo — Final Watch Party",
      summary: eventSummary,
      description: eventDescription,
      startAt: new Date("2026-05-20T18:30:00+07:00"),
      endAt: new Date("2026-05-20T23:00:00+07:00"),
      coverBlobUrl:
        "https://placehold.co/1200x630/001489/ffffff/png?text=Demo+Watch+Party",
      coverBlobPath: "__seed__/demo-final-ucl-2026/cover.webp",
      registrationManualClosed: false,
      registrationCapacity: null,
      venueId: demoVenue.id,
      status: EventStatus.active,
      ticketMemberPrice: 125_000,
      ticketNonMemberPrice: 175_000,
      pricingSource: PricingSource.global_default,
      menuMode: MenuMode.PRESELECT,
      menuSelection: MenuSelection.SINGLE,
      voucherPrice: null,
      picAdminProfileId: ownerProfile.id,
      bankAccountId: bank.id,
    },
  });

  await prisma.eventVenueMenuItem.deleteMany({ where: { eventId: event.id } });
  await prisma.eventVenueMenuItem.createMany({
    data: [
      { eventId: event.id, venueMenuItemId: vmBurger.id, sortOrder: 1 },
      { eventId: event.id, venueMenuItemId: vmNasi.id, sortOrder: 2 },
    ],
  });

  const catalogVenueItems = await prisma.venueMenuItem.findMany({
    where: { venueId: catalogVenue.id },
    orderBy: { sortOrder: "asc" },
  });

  const voucherSummary =
    "Kopdar santai dengan sistem voucher menu — tiket dan voucher dibayar saat daftar; pilihan hidangan ditukar di lokasi oleh panitia.";
  const voucherDescription =
    "<p>Acara seed kedua untuk menguji mode <strong>VOUCHER</strong> (tanpa pemilihan menu pada formulir).</p><p>Menu yang bisa ditukar dengan voucher sama dengan daftar voucher-eligible di venue katalog.</p>";

  const voucherEvent = await prisma.event.upsert({
    where: { slug: "demo-kopdar-voucher-2026" },
    update: {
      title: "Demo — Kopdar Voucher Juni",
      bankAccountId: bank.id,
      picAdminProfileId: ownerProfile.id,
      venueId: catalogVenue.id,
      summary: voucherSummary,
      description: voucherDescription,
      startAt: new Date("2026-06-14T17:00:00+07:00"),
      endAt: new Date("2026-06-14T21:30:00+07:00"),
      registrationManualClosed: false,
      registrationCapacity: 40,
      status: EventStatus.active,
      ticketMemberPrice: 100_000,
      ticketNonMemberPrice: 150_000,
      pricingSource: PricingSource.global_default,
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.SINGLE,
      voucherPrice: 85_000,
      coverBlobUrl:
        "https://placehold.co/1200x630/034694/ffffff/png?text=Demo+Kopdar+Voucher",
      coverBlobPath: "__seed__/demo-kopdar-voucher-2026/cover.webp",
    },
    create: {
      slug: "demo-kopdar-voucher-2026",
      title: "Demo — Kopdar Voucher Juni",
      summary: voucherSummary,
      description: voucherDescription,
      startAt: new Date("2026-06-14T17:00:00+07:00"),
      endAt: new Date("2026-06-14T21:30:00+07:00"),
      coverBlobUrl:
        "https://placehold.co/1200x630/034694/ffffff/png?text=Demo+Kopdar+Voucher",
      coverBlobPath: "__seed__/demo-kopdar-voucher-2026/cover.webp",
      registrationManualClosed: false,
      registrationCapacity: 40,
      venueId: catalogVenue.id,
      status: EventStatus.active,
      ticketMemberPrice: 100_000,
      ticketNonMemberPrice: 150_000,
      pricingSource: PricingSource.global_default,
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.SINGLE,
      voucherPrice: 85_000,
      picAdminProfileId: ownerProfile.id,
      bankAccountId: bank.id,
    },
  });

  await prisma.eventVenueMenuItem.deleteMany({
    where: { eventId: voucherEvent.id },
  });
  const voucherMenuRows = catalogVenueItems
    .filter((m) => m.voucherEligible)
    .map((m, i) => ({
      eventId: voucherEvent.id,
      venueMenuItemId: m.id,
      sortOrder: i + 1,
    }));
  if (voucherMenuRows.length > 0) {
    await prisma.eventVenueMenuItem.createMany({ data: voucherMenuRows });
  }

  const mgmtCount = MASTER_MEMBER_SEEDS.filter(
    (r) => r.managementPublicCode,
  ).length;
  console.log(
    "Seed OK:",
    event.slug,
    "+",
    voucherEvent.slug,
    `· venue nobar=${demoVenue.id} · venue voucher=${catalogVenue.id} (${MASTER_MEMBER_SEEDS.length} MasterMember · ${mgmtCount} ManagementMember · PIC = Owner ${ownerProfile.id})`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
