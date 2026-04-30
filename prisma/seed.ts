import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient, EventStatus, MenuMode, MenuSelection, PricingSource } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // Upsert demo PIC member
  const pic = await prisma.masterMember.upsert({
    where: { memberNumber: "CISC-DEMO-PIC-1" },
    update: {},
    create: {
      memberNumber: "CISC-DEMO-PIC-1",
      fullName: "Demo PIC Pengurus",
      isActive: true,
      isPengurus: true,
      canBePIC: true,
    },
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
    },
    create: {
      slug: "demo-final-ucl-2026",
      title: "Demo — Final Watch Party",
      startAt: new Date("2026-05-20T18:30:00+07:00"),
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

  console.log("Seed OK:", event.slug);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
