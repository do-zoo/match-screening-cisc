import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import { formatCurrencyIdr } from "@/components/admin/registration-detail-panels/shared/format";
import { TicketRole } from "@prisma/client";

type Props = {
  registration: DetailRegistration;
};

type PriceSnapshotTicket = Pick<
  DetailRegistration["tickets"][number],
  | "id"
  | "role"
  | "fullName"
  | "ticketPriceApplied"
  | "mandatoryMenuItemName"
  | "mandatoryMenuPriceApplied"
  | "computedTotalAtSubmit"
>;

export type PriceSnapshotRow = {
  id: string;
  label: string;
  ticketPriceApplied: number;
  mandatoryMenuItemName: string;
  mandatoryMenuPriceApplied: number;
  computedTotalAtSubmit: number;
};

export function isAdditivePriceSnapshot(row: PriceSnapshotRow): boolean {
  return (
    row.ticketPriceApplied + row.mandatoryMenuPriceApplied ===
    row.computedTotalAtSubmit
  );
}

function roleLabel(role: PriceSnapshotTicket["role"]): string {
  return role === TicketRole.primary ? "Utama" : "Partner";
}

export function buildPriceSnapshotSummary(tickets: PriceSnapshotTicket[]): {
  rows: PriceSnapshotRow[];
  total: number;
} {
  const rows = tickets.map((ticket) => ({
    id: ticket.id,
    label: `${roleLabel(ticket.role)} - ${ticket.fullName}`,
    ticketPriceApplied: ticket.ticketPriceApplied,
    mandatoryMenuItemName: ticket.mandatoryMenuItemName,
    mandatoryMenuPriceApplied: ticket.mandatoryMenuPriceApplied,
    computedTotalAtSubmit: ticket.computedTotalAtSubmit,
  }));

  return {
    rows,
    total: rows.reduce((sum, row) => sum + row.computedTotalAtSubmit, 0),
  };
}

export function PriceSnapshotSection({ registration }: Props) {
  const summary = buildPriceSnapshotSummary(registration.tickets);

  return (
    <div className="grid gap-2 text-sm">
      <div className="font-medium">Rincian harga (snapshot)</div>
      {summary.rows.map((row, index) => (
        <div
          key={row.id}
          className={index === 0 ? "grid gap-2" : "grid gap-2 border-t pt-2"}
        >
          <div className="font-medium text-muted-foreground">{row.label}</div>
          {isAdditivePriceSnapshot(row) ? (
            <>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-muted-foreground">Tiket</span>
                <span className="font-mono">
                  {formatCurrencyIdr(row.ticketPriceApplied)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-muted-foreground">Menu wajib</span>
                <span>
                  {row.mandatoryMenuItemName}{" "}
                  <span className="font-mono text-muted-foreground">
                    ({formatCurrencyIdr(row.mandatoryMenuPriceApplied)})
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-medium">
                  {formatCurrencyIdr(row.computedTotalAtSubmit)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-muted-foreground">
                  Tiket (termasuk menu wajib)
                </span>
                <span className="font-mono font-medium">
                  {formatCurrencyIdr(row.ticketPriceApplied)}
                </span>
              </div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                {row.mandatoryMenuItemName}
                {row.mandatoryMenuPriceApplied > 0 ? (
                  <>
                    {" "}
                    · Acuan alokasi menu{" "}
                    {formatCurrencyIdr(row.mandatoryMenuPriceApplied)}
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-2 border-t pt-2">
        <span className="font-medium">Total dibayar saat kirim</span>
        <span className="font-mono text-base font-semibold">
          {formatCurrencyIdr(summary.total)}
        </span>
      </div>
    </div>
  );
}
