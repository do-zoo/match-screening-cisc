import { Badge } from "@/components/ui/badge";
import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import {
  RegistrationTicketsTable,
  type RegistrationTicketRow,
} from "@/components/admin/registration-tickets-table";
import { TicketRole as TicketRoleEnum } from "@prisma/client";

type Props = {
  registration: DetailRegistration;
};

function roleLabel(role: DetailRegistration["tickets"][number]["role"]): string {
  return role === TicketRoleEnum.primary ? "Utama" : "Partner";
}

export function TicketsAndMenuSection({ registration }: Props) {
  const ticketRows: RegistrationTicketRow[] = registration.tickets.map(
    (ticket) => ({
      id: ticket.id,
      role: ticket.role,
      fullName: ticket.fullName,
      whatsapp: ticket.whatsapp,
      memberNumber: ticket.memberNumber,
      menuSummary:
        ticket.menuSelections.length === 0
          ? "-"
          : ticket.menuSelections.map((s) => s.menuItem.name).join(", "),
    }),
  );

  return (
    <div className="grid gap-3">
      <div className="hidden sm:block">
        <RegistrationTicketsTable tickets={ticketRows} />
      </div>
      <div className="grid gap-3 sm:hidden">
        {registration.tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="rounded-lg border bg-card p-3 text-sm shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">{roleLabel(ticket.role)}</Badge>
              <span className="font-medium">{ticket.fullName}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <div>WhatsApp: {ticket.whatsapp ?? "-"}</div>
              <div>Nomor member: {ticket.memberNumber ?? "-"}</div>
              <div>Menu: {ticketRows.find((r) => r.id === ticket.id)?.menuSummary ?? "-"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
