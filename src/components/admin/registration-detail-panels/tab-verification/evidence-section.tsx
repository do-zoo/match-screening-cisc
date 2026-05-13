import Image from "next/image";
import Link from "next/link";

import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import { formatUploadPurpose } from "@/components/admin/registration-detail-panels/shared/format";
import type { TicketContextVm } from "@/lib/registrations/admin-ticket-context";
import { eventRegistrationDetailPath } from "@/lib/admin/event-registrants-paths";

type Props = {
  eventId: string;
  registration: DetailRegistration;
  ticketContext: TicketContextVm;
};

export function EvidenceSection({ eventId, registration, ticketContext }: Props) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Unggahan</h3>
        {registration.uploads.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Tidak ada unggahan pada pendaftaran ini.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {registration.uploads.map((upload) => (
              <a
                key={upload.id}
                href={upload.blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5 text-xs">
                  <div className="truncate font-medium">
                    {formatUploadPurpose(upload.purpose)}
                  </div>
                  <div className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {Math.round(upload.bytes / 1024)} KB
                  </div>
                </div>
                <div className="relative mx-auto aspect-square w-full max-h-[140px] bg-muted/30 p-2">
                  <Image
                    src={upload.blobUrl}
                    alt={upload.originalFilename ?? formatUploadPurpose(upload.purpose)}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-contain"
                  />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 text-sm">
        <h3 className="text-sm font-semibold tracking-tight">Konteks tiket & kursi</h3>
        {ticketContext.kind === "error" ? (
          <p className="text-muted-foreground">{ticketContext.message}</p>
        ) : (
          <dl className="grid gap-3">
            <div>
              <dt className="text-muted-foreground">Pengurus / komite (tiket utama)</dt>
              <dd className="mt-1">
                {ticketContext.managementMember.state === "via_public_code" && (
                  <span>
                    Kode pengurus{" "}
                    <span className="font-mono font-medium">
                      {ticketContext.managementMember.publicCode}
                    </span>
                    {" — "}
                    {ticketContext.managementMember.fullName}
                  </span>
                )}
                {ticketContext.managementMember.state === "no_primary_number" && (
                  <span className="text-muted-foreground">
                    Tidak ada nomor member pada tiket utama — lookup tidak dijalankan.
                  </span>
                )}
                {ticketContext.managementMember.state === "not_in_directory" && (
                  <span className="text-amber-700 dark:text-amber-400">
                    Nomor utama tidak ditemukan di direktori member aktif.
                  </span>
                )}
                {ticketContext.managementMember.state === "found" && (
                  <span>
                    Status komite/pengurus:{" "}
                    <span className="font-medium">
                      {ticketContext.managementMember.isManagementMember ? "Ya" : "Tidak"}
                    </span>
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tiket partner</dt>
              <dd className="mt-1 text-muted-foreground">
                {!ticketContext.partner ? (
                  "Tidak ada tiket partner."
                ) : (
                  <span>
                    {ticketContext.partner.fullName} · WA{" "}
                    {ticketContext.partner.whatsapp ?? "-"} · Member{" "}
                    {ticketContext.partner.memberNumber ?? "-"} ·{" "}
                    {ticketContext.partner.ticketPriceTypeLabel}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bentrok nomor (acara ini)</dt>
              <dd className="mt-1">
                {ticketContext.conflicts.length === 0 ? (
                  <span className="text-muted-foreground">
                    Tidak ada registrasi lain dengan nomor member yang sama pada tiket.
                  </span>
                ) : (
                  <ul className="list-inside list-disc space-y-2">
                    {ticketContext.conflicts.map((c) => (
                      <li key={c.registrationId}>
                        <span className="text-muted-foreground">
                          {c.contactName} — {c.memberNumbers.join(", ")} —{" "}
                        </span>
                        <Link
                          href={eventRegistrationDetailPath(eventId, c.registrationId)}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          buka detail
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
