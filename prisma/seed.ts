import "dotenv/config";

import {
  AdminRole,
  EventStatus,
  MenuMode,
  MenuSelection,
  PrismaClient,
  PricingSource,
} from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

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

  const event = await prisma.event.upsert({
    where: { slug: "demo-final-ucl-2026" },
    update: {
      bankAccountId: bank.id,
      picAdminProfileId: ownerProfile.id,
      summary:
        "Nobar final bersama komunitas Chelsea FC Indonesia — daftar, pilih menu, unggah bukti transfer.",
      description:
        "<p>Acara demo untuk alur pendaftaran. <strong>Perbarui deskripsi ini</strong> lewat admin ketika editor WYSIWYG tersedia.</p><p>Pastikan pembayaran menggunakan rekening yang tertera di formulir.</p>",
      endAt: new Date("2026-05-20T23:00:00+07:00"),
      coverBlobUrl:
        "https://placehold.co/1200x630/001489/ffffff/png?text=Demo+Watch+Party",
      coverBlobPath: "__seed__/demo-final-ucl-2026/cover.webp",
    },
    create: {
      slug: "demo-final-ucl-2026",
      title: "Demo — Final Watch Party",
      summary:
        "Nobar final bersama komunitas Chelsea FC Indonesia — daftar, pilih menu, unggah bukti transfer.",
      description:
        "<p>Acara demo untuk alur pendaftaran. <strong>Perbarui deskripsi ini</strong> lewat admin ketika editor WYSIWYG tersedia.</p><p>Pastikan pembayaran menggunakan rekening yang tertera di formulir.</p>",
      startAt: new Date("2026-05-20T18:30:00+07:00"),
      endAt: new Date("2026-05-20T23:00:00+07:00"),
      coverBlobUrl:
        "https://placehold.co/1200x630/001489/ffffff/png?text=Demo+Watch+Party",
      coverBlobPath: "__seed__/demo-final-ucl-2026/cover.webp",
      registrationManualClosed: false,
      registrationCapacity: null,
      venueName: "Venue Demo",
      venueAddress: "Jl. Demo No. 1, Tangerang Selatan",
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

  await prisma.eventMenuItem.deleteMany({ where: { eventId: event.id } });
  await prisma.eventMenuItem.createMany({
    data: [
      {
        eventId: event.id,
        name: "Paket Burger",
        price: 55_000,
        sortOrder: 1,
        voucherEligible: true,
      },
      {
        eventId: event.id,
        name: "Paket Nasi",
        price: 50_000,
        sortOrder: 2,
        voucherEligible: true,
      },
    ],
  });

  const mgmtCount = MASTER_MEMBER_SEEDS.filter(
    (r) => r.managementPublicCode,
  ).length;
  console.log(
    "Seed OK:",
    event.slug,
    `(${MASTER_MEMBER_SEEDS.length} MasterMember · ${mgmtCount} ManagementMember · PIC acara = Owner admin ${ownerProfile.id})`,
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
