import Link from "next/link";
import { TicketRole as TicketRoleEnum } from "@prisma/client";

import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import { eventRegistrationDetailPath } from "@/lib/admin/event-registrants-paths";

type Props = {
  eventId: string;
  registration: DetailRegistration;
};

function roleLabel(role: DetailRegistration["ticketRole"]): string {
  return role === TicketRoleEnum.primary ? "Utama" : "Partner";
}

export function RelationsSection({ eventId, registration }: Props) {
  return (
    <div className="grid gap-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-muted-foreground">Peran tiket</span>
        <span className="font-medium">{roleLabel(registration.ticketRole)}</span>
      </div>
      {registration.ticketRole === TicketRoleEnum.partner &&
      registration.relationsPrimary ? (
        <p>
          <span className="text-muted-foreground">Pembeli utama: </span>
          <Link
            href={eventRegistrationDetailPath(
              eventId,
              registration.relationsPrimary.id,
            )}
            className="font-medium underline-offset-4 hover:underline"
          >
            {registration.relationsPrimary.contactName}
          </Link>
        </p>
      ) : null}
      {registration.ticketRole === TicketRoleEnum.primary &&
      registration.relationsPartners.length > 0 ? (
        <div className="grid gap-1">
          <span className="text-muted-foreground">Partner</span>
          <ul className="list-inside list-disc">
            {registration.relationsPartners.map((p) => (
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
    </div>
  );
}
