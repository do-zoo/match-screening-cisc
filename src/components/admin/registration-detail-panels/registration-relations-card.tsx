import Link from "next/link";
import type { TicketRole } from "@prisma/client";
import { TicketRole as TicketRoleEnum } from "@prisma/client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { eventRegistrationDetailPath } from "@/lib/admin/event-registrants-paths";

function formatIdr(n: number): string {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
  return formatted.replace(/\s+/g, "");
}

type Props = {
  eventId: string;
  ticketRole: TicketRole;
  primaryRegistration: { id: string; contactName: string } | null;
  partnerRegistrations: Array<{ id: string; contactName: string }>;
  ticketPriceApplied: number;
  mandatoryMenuPriceApplied: number;
  mandatoryMenuName: string;
};

function roleLabel(role: TicketRole): string {
  return role === TicketRoleEnum.primary ? "Utama" : "Partner";
}

export function RegistrationRelationsCard({
  eventId,
  ticketRole,
  primaryRegistration,
  partnerRegistrations,
  ticketPriceApplied,
  mandatoryMenuPriceApplied,
  mandatoryMenuName,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Peran & hubungan</CardTitle>
        <CardDescription>
          Tiket utama dan partner adalah baris registrasi terpisah.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">Peran tiket</span>
          <span className="font-medium">{roleLabel(ticketRole)}</span>
        </div>
        {ticketRole === TicketRoleEnum.partner && primaryRegistration ? (
          <p>
            <span className="text-muted-foreground">Pembeli utama: </span>
            <Link
              href={eventRegistrationDetailPath(eventId, primaryRegistration.id)}
              className="font-medium underline-offset-4 hover:underline"
            >
              {primaryRegistration.contactName}
            </Link>
          </p>
        ) : null}
        {ticketRole === TicketRoleEnum.primary && partnerRegistrations.length > 0 ? (
          <div className="grid gap-1">
            <span className="text-muted-foreground">Partner</span>
            <ul className="list-inside list-disc">
              {partnerRegistrations.map((p) => (
                <li key={p.id}>
                  <Link
                    href={eventRegistrationDetailPath(eventId, p.id)}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {p.contactName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="border-t pt-3">
          <div className="mb-2 font-medium">Rincian harga (snapshot)</div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">Tiket</span>
            <span className="font-mono">{formatIdr(ticketPriceApplied)}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">Menu wajib</span>
            <span>
              {mandatoryMenuName}{" "}
              <span className="font-mono text-muted-foreground">
                ({formatIdr(mandatoryMenuPriceApplied)})
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
