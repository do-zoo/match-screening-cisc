import type { CommitteeTicketDefaultPrices } from "@/lib/events/event-admin-defaults";

/** Harga saran form acara (mode `global_default`) — hanya dari env + fallback; tidak ada penyimpanan DB. */
export function CommitteeDefaultPricingForm(props: {
  initial: CommitteeTicketDefaultPrices;
}) {
  return (
    <div className="max-w-md space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Tiket member (IDR)</p>
        <p className="text-muted-foreground font-mono text-sm">
          {props.initial.ticketMemberPrice.toLocaleString("id-ID")}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Tiket non-member (IDR)</p>
        <p className="text-muted-foreground font-mono text-sm">
          {props.initial.ticketNonMemberPrice.toLocaleString("id-ID")}
        </p>
      </div>
      <p className="text-muted-foreground text-xs">
        Nilai diambil dari variabel lingkungan{" "}
        <code className="rounded bg-muted px-1">MATCH_DEFAULT_TICKET_MEMBER_IDR</code> dan{" "}
        <code className="rounded bg-muted px-1">MATCH_DEFAULT_TICKET_NON_MEMBER_IDR</code>
        , lalu fallback bawaan aplikasi bila kosong.
      </p>
    </div>
  );
}
