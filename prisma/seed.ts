import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient, EventStatus, MenuMode, MenuSelection, PricingSource } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

/** Semua kombinasi isActive × isPengurus × canBePIC (8 tipe). Suffix nomor = biner ABP (Active·Pengurus·PIC). */
type MasterMemberSeed = {
  memberNumber: string;
  fullName: string;
  isActive: boolean;
  isPengurus: boolean;
  canBePIC: boolean;
  whatsapp?: string | null;
};

const MASTER_MEMBER_SEEDS: MasterMemberSeed[] = [
  {
    memberNumber: "CISC-DEMO-PIC-1",
    fullName: "Demo PIC Pengurus",
    isActive: true,
    isPengurus: true,
    canBePIC: true,
    whatsapp: "+6281380013800",
  },
  {
    memberNumber: "CISC-SEED-110",
    fullName: "Seed · aktif · pengurus · bukan PIC",
    isActive: true,
    isPengurus: true,
    canBePIC: false,
  },
  {
    memberNumber: "CISC-SEED-101",
    fullName: "Seed · aktif · anggota · eligible PIC",
    isActive: true,
    isPengurus: false,
    canBePIC: true,
  },
  {
    memberNumber: "CISC-SEED-100",
    fullName: "Seed · aktif · anggota biasa",
    isActive: true,
    isPengurus: false,
    canBePIC: false,
  },
  {
    memberNumber: "CISC-SEED-011",
    fullName: "Seed · nonaktif · pengurus · PIC",
    isActive: false,
    isPengurus: true,
    canBePIC: true,
  },
  {
    memberNumber: "CISC-SEED-010",
    fullName: "Seed · nonaktif · pengurus · bukan PIC",
    isActive: false,
    isPengurus: true,
    canBePIC: false,
  },
  {
    memberNumber: "CISC-SEED-001",
    fullName: "Seed · nonaktif · anggota · eligible PIC",
    isActive: false,
    isPengurus: false,
    canBePIC: true,
  },
  {
    memberNumber: "CISC-SEED-000",
    fullName: "Seed · nonaktif · anggota biasa",
    isActive: false,
    isPengurus: false,
    canBePIC: false,
  },
];

async function main() {
  for (const row of MASTER_MEMBER_SEEDS) {
    const whatsapp =
      row.whatsapp === undefined ? undefined : row.whatsapp ?? null;
    await prisma.masterMember.upsert({
      where: { memberNumber: row.memberNumber },
      update: {
        fullName: row.fullName,
        isActive: row.isActive,
        isPengurus: row.isPengurus,
        canBePIC: row.canBePIC,
        ...(whatsapp !== undefined ? { whatsapp } : {}),
      },
      create: {
        memberNumber: row.memberNumber,
        fullName: row.fullName,
        isActive: row.isActive,
        isPengurus: row.isPengurus,
        canBePIC: row.canBePIC,
        ...(whatsapp !== undefined ? { whatsapp } : {}),
      },
    });
  }

  const pic = await prisma.masterMember.findUniqueOrThrow({
    where: { memberNumber: "CISC-DEMO-PIC-1" },
  });

  // Find or create bank account — update in place to avoid FK conflicts on re-runs
  // (PicBankAccount has no unique constraint, so we find by ownerMemberId + accountNumber)
  const existingBank = await prisma.picBankAccount.findFirst({
    where: { ownerMemberId: pic.id, accountNumber: "1234567890" },
  });
  const bank = existingBank
    ? await prisma.picBankAccount.update({
        where: { id: existingBank.id },
        data: { bankName: "BCA", accountName: "Demo CISC Tangsel", isActive: true },
      })
    : await prisma.picBankAccount.create({
        data: {
          ownerMemberId: pic.id,
          bankName: "BCA",
          accountNumber: "1234567890",
          accountName: "Demo CISC Tangsel",
          isActive: true,
        },
      });

  // Upsert event — always update bankAccountId (stable across re-runs since bank is reused)
  const event = await prisma.event.upsert({
    where: { slug: "demo-final-ucl-2026" },
    update: {
      bankAccountId: bank.id,
      picMasterMemberId: pic.id,
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
      picMasterMemberId: pic.id,
      bankAccountId: bank.id,
    },
  });

  // Recreate menu items (deleteMany + createMany is idempotent and order-safe)
  await prisma.eventMenuItem.deleteMany({ where: { eventId: event.id } });
  await prisma.eventMenuItem.createMany({
    data: [
      { eventId: event.id, name: "Paket Burger", price: 55_000, sortOrder: 1, voucherEligible: true },
      { eventId: event.id, name: "Paket Nasi", price: 50_000, sortOrder: 2, voucherEligible: true },
    ],
  });

  console.log("Seed OK:", event.slug, `(${MASTER_MEMBER_SEEDS.length} MasterMember variants)`);
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
