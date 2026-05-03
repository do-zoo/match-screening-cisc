import type { Metadata } from "next";
import Link from "next/link";

import { CommitteeDefaultPricingForm } from "@/components/admin/committee-default-pricing-form";

export const metadata: Metadata = { title: "Harga" };
import { prisma } from "@/lib/db/prisma";
import {
  COMMITTEE_TICKET_DEFAULTS_KEY,
  pickCommitteeTicketDefaults,
} from "@/lib/events/event-admin-defaults";

export default async function CommitteePricingSettingsPage() {
  const row = await prisma.committeeTicketDefaults.findUnique({
    where: { singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY },
    select: { ticketMemberPrice: true, ticketNonMemberPrice: true },
  });
  const display = pickCommitteeTicketDefaults(row);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Harga default</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Harga default global</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Dipakai saat acara memilih sumber harga Default komite (<code>global_default</code>).
        </p>
      </div>
      <CommitteeDefaultPricingForm
        initial={{ ...display, persisted: row != null }}
      />
    </div>
  );
}
