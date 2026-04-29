import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import type { SubmitPricingResult } from "@/lib/pricing/compute-submit-total";

type Props = {
  event: SerializedEventForRegistration;
  pricing: SubmitPricingResult | null;
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export function PriceBreakdown({ event, pricing }: Props) {
  if (!pricing) {
    return (
      <div className="rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        Lengkapi pilihan menu / member untuk melihat estimasi total.
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
      <div className="text-sm font-medium">Estimasi total (snapshot)</div>
      <dl className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[hsl(var(--muted-foreground))]">Member (acara)</dt>
          <dd className="font-mono">{idr(event.ticketMemberPrice)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[hsl(var(--muted-foreground))]">Non-member (acara)</dt>
          <dd className="font-mono">{idr(event.ticketNonMemberPrice)}</dd>
        </div>

        <div className="flex items-center justify-between gap-4">
          <dt className="text-[hsl(var(--muted-foreground))]">Voucher menu (acara)</dt>
          <dd className="font-mono">
            {pricing.voucherPriceApplied == null
              ? "—"
              : idr(pricing.voucherPriceApplied)}
          </dd>
        </div>

        <div className="mt-2 border-t border-[hsl(var(--border))] pt-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="font-medium">Total (estimasi)</dt>
            <dd className="font-mono text-base font-semibold">
              {idr(pricing.computedTotalAtSubmit)}
            </dd>
          </div>
        </div>

        <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">
          Total ini mengikuti pilihan form saat ini. Total final akan dikunci oleh
          server saat pengiriman.
        </p>
      </dl>
    </div>
  );
}
