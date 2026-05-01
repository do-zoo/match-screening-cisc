import type {
  PricingLine,
  SubmitPricingResult,
} from "@/lib/pricing/compute-submit-total";

type Props = {
  pricing: SubmitPricingResult | null;
};

const formatIdr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

function linesForRole(lines: PricingLine[], role: PricingLine["role"]) {
  return lines.filter((l) => l.role === role);
}

function subtotalForRole(roleLines: PricingLine[]) {
  return roleLines.reduce((s, l) => s + l.amount, 0);
}

function sectionHeading(
  role: PricingLine["role"],
  roleLines: PricingLine[],
): string {
  if (role === "partner") return "Tiket pasangan (Pengurus)";
  const ticket = roleLines.find((l) => l.kind === "ticket");
  if (!ticket) return "Tiket utama";
  if (ticket.label === "Tiket Member") return "Tiket utama (Member)";
  if (ticket.label === "Tiket Non-member") return "Tiket utama (Non-member)";
  return "Tiket utama";
}

function LineRow({ line }: { line: PricingLine }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{line.label}</span>
      <span className="shrink-0 font-mono tabular-nums">{formatIdr(line.amount)}</span>
    </div>
  );
}

export function PriceBreakdown({ pricing }: Props) {
  if (!pricing) {
    return (
      <div className="rounded-lg border bg-card p-4 text-muted-foreground">
        <div className="mb-3 text-sm font-medium text-foreground">Ringkasan biaya</div>
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between gap-4">
              <div className="h-4 max-w-[60%] flex-1 rounded bg-muted/40" />
              <div className="h-4 w-24 shrink-0 rounded bg-muted/40" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Lengkapi pilihan menu untuk melihat estimasi.
        </p>
      </div>
    );
  }

  const primaryLines = linesForRole(pricing.lines, "primary");
  const partnerLines = linesForRole(pricing.lines, "partner");

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 text-sm font-medium text-foreground">Ringkasan biaya</div>

      <div className="space-y-4">
        {primaryLines.length > 0 ? (
          <section className="space-y-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {sectionHeading("primary", primaryLines)}
            </h3>
            <div className="space-y-2">
              {primaryLines.map((line, idx) => (
                <LineRow key={`primary-${line.kind}-${idx}`} line={line} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-2 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono font-medium tabular-nums">
                {formatIdr(subtotalForRole(primaryLines))}
              </span>
            </div>
          </section>
        ) : null}

        {partnerLines.length > 0 ? (
          <section className="space-y-2 border-t border-border pt-4 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {sectionHeading("partner", partnerLines)}
            </h3>
            <div className="space-y-2">
              {partnerLines.map((line, idx) => (
                <LineRow key={`partner-${line.kind}-${idx}`} line={line} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-2 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono font-medium tabular-nums">
                {formatIdr(subtotalForRole(partnerLines))}
              </span>
            </div>
          </section>
        ) : null}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium text-foreground">Total dibayar</span>
          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
            {formatIdr(pricing.computedTotalAtSubmit)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Total final dikunci server saat pengiriman.
      </p>
    </div>
  );
}
