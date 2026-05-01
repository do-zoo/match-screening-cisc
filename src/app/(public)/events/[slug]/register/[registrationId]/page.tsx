import { RegistrationStatusBadge } from "@/components/admin/registration-status-badge";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function RegistrationReceiptPage({
  params,
}: {
  params: Promise<{ slug: string; registrationId: string }>;
}) {
  const { slug, registrationId } = await params;

  const registration = await prisma.registration.findFirst({
    where: {
      id: registrationId,
      event: { slug },
    },
    include: {
      event: {
        include: { bankAccount: true },
      },
    },
  });

  if (!registration) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Pendaftaran diterima</h1>
          <RegistrationStatusBadge status={registration.status} />
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Simpan halaman ini sebagai bukti pemesanan sementara. Tim akan memverifikasi
          pembayaran dan status kamu akan di-update.
        </p>
      </header>

      <section className="grid gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <div className="text-sm font-medium">Ringkas</div>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-6">
            <dt className="text-[hsl(var(--muted-foreground))]">Acara</dt>
            <dd className="text-right">{registration.event.title}</dd>
          </div>

          <div className="flex items-start justify-between gap-6">
            <dt className="text-[hsl(var(--muted-foreground))]">Nomor pemesanan</dt>
            <dd className="max-w-[60%] break-all font-mono text-right text-xs">
              {registration.id}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-6">
            <dt className="text-[hsl(var(--muted-foreground))]">Total (snapshot)</dt>
            <dd className="font-mono text-base font-semibold">
              {idr(registration.computedTotalAtSubmit)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <div className="text-sm font-medium">Instruksi transfer</div>
        <div className="text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          Transfer ke{" "}
          <span className="font-medium text-foreground">
            {registration.event.bankAccount.bankName}
          </span>{" "}
          atas nama{" "}
          <span className="font-medium text-foreground">
            {registration.event.bankAccount.accountName}
          </span>
          .
        </div>
        <div className="rounded-md bg-[hsl(var(--secondary))] p-4 font-mono text-sm">
          {registration.event.bankAccount.accountNumber}
        </div>
      </section>
    </main>
  );
}
