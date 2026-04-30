import { notFound } from "next/navigation";

import { RegistrationFormClientOnly } from "@/components/public/registration-form-client-only";
import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { prisma } from "@/lib/db/prisma";

export default async function EventRegistrationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const event = await prisma.event.findFirst({
    where: { slug, status: "active" },
    include: {
      bankAccount: true,
      menuItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!event) notFound();

  const serialized: SerializedEventForRegistration = {
    slug: event.slug,
    title: event.title,
    venueName: event.venueName,
    startAtIso: event.startAt.toISOString(),
    menuMode: event.menuMode,
    menuSelection: event.menuSelection,
    voucherPrice: event.voucherPrice,
    ticketMemberPrice: event.ticketMemberPrice,
    ticketNonMemberPrice: event.ticketNonMemberPrice,
    bankAccount: {
      bankName: event.bankAccount.bankName,
      accountNumber: event.bankAccount.accountNumber,
      accountName: event.bankAccount.accountName,
    },
    menuItems: event.menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      price: m.price,
      voucherEligible: m.voucherEligible,
    })),
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <RegistrationFormClientOnly event={serialized} />
    </main>
  );
}
