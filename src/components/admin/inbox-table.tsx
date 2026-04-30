import Link from "next/link";
import type { RegistrationStatus, TicketRole } from "@prisma/client";

import { RegistrationStatusBadge } from "@/components/admin/registration-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InboxRegistration = {
  id: string;
  createdAt: Date;
  contactName: string;
  contactWhatsapp: string;
  claimedMemberNumber: string | null;
  computedTotalAtSubmit: number;
  status: RegistrationStatus;
  tickets: Array<{
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
  }>;
};

type InboxTableProps = {
  eventId: string;
  registrations: InboxRegistration[];
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function InboxTable({ eventId, registrations }: InboxTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrations</CardTitle>
        <CardDescription>
          Newest submissions appear first. Open a row to review uploads and
          ticket details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No registrations have been submitted for this event yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Primary ticket</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((registration) => {
                const primaryTicket = registration.tickets.find(
                  (ticket) => ticket.role === "primary",
                );

                return (
                  <TableRow key={registration.id}>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(registration.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/events/${eventId}/inbox/${registration.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {registration.contactName}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">
                        {registration.contactWhatsapp}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{primaryTicket?.fullName ?? "-"}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {primaryTicket?.memberNumber ??
                          registration.claimedMemberNumber ??
                          "non-member"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <RegistrationStatusBadge status={registration.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {idrFormatter.format(registration.computedTotalAtSubmit)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
