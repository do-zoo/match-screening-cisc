import Link from "next/link";
import type { RegistrationStatus, TicketRole } from "@prisma/client";

import { RegistrationStatusBadge } from "@/components/admin/registration-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { eventRegistrationDetailPath } from "@/lib/admin/event-registrants-paths";

export type EventRegistrantCardRow = {
  id: string;
  createdAt: string;
  contactName: string;
  contactWhatsapp: string;
  claimedMemberNumber: string | null;
  computedTotalAtSubmit: number;
  status: RegistrationStatus;
  ticketRole: TicketRole;
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

function ticketRoleLabel(role: TicketRole): string {
  return role === "primary" ? "Utama" : "Partner";
}

export function AdminEventRegistrantsCardsView({
  eventId,
  listPath,
  preservedQuery,
  registrations,
  pagination,
}: {
  eventId: string;
  listPath: string;
  preservedQuery: Record<string, string | undefined>;
  registrations: EventRegistrantCardRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
}) {
  return (
    <div className="flex flex-col gap-8">
      {registrations.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Belum ada pendaftaran untuk filter ini.
        </div>
      ) : (
        <>
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {registrations.map((r) => (
              <li key={r.id}>
                <Card className="flex h-full flex-col">
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-snug">
                        <Link
                          href={eventRegistrationDetailPath(eventId, r.id)}
                          className="underline-offset-4 hover:underline"
                        >
                          {r.contactName}
                        </Link>
                      </CardTitle>
                      <RegistrationStatusBadge status={r.status} />
                    </div>
                    <p className="text-muted-foreground font-mono text-xs">
                      {r.contactWhatsapp}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {ticketRoleLabel(r.ticketRole)}
                      {r.claimedMemberNumber ? (
                        <>
                          {" "}
                          · <span className="font-mono">{r.claimedMemberNumber}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Dikirim {dateFormatter.format(new Date(r.createdAt))}
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {idrFormatter.format(r.computedTotalAtSubmit)}
                    </p>
                  </CardHeader>
                  <CardFooter className="mt-auto border-t pt-4">
                    <Link
                      href={eventRegistrationDetailPath(eventId, r.id)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Buka detail
                    </Link>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
          <TablePagination
            pathname={listPath}
            preservedQuery={preservedQuery}
            currentPage={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            className="bg-card rounded-lg border px-3 py-3"
          />
        </>
      )}
    </div>
  );
}
