import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import { formatCurrencyIdr } from "@/components/admin/registration-detail-panels/shared/format";

type Props = {
  registration: DetailRegistration;
};

export function PriceSnapshotSection({ registration }: Props) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="font-medium">Rincian harga (snapshot)</div>
      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-muted-foreground">Tiket</span>
        <span className="font-mono">{formatCurrencyIdr(registration.ticketPriceApplied)}</span>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-muted-foreground">Menu wajib</span>
        <span>
          {registration.mandatoryMenuItemName}{" "}
          <span className="font-mono text-muted-foreground">
            ({formatCurrencyIdr(registration.mandatoryMenuPriceApplied)})
          </span>
        </span>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t pt-2">
        <span className="font-medium">Total saat kirim</span>
        <span className="font-mono text-base font-semibold">
          {formatCurrencyIdr(registration.computedTotalAtSubmit)}
        </span>
      </div>
    </div>
  );
}
