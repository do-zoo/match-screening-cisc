import type { Metadata } from "next";
import Link from "next/link";

import { ClubAuditLogSection } from "@/components/admin/club-audit-log-table";

export const metadata: Metadata = { title: "Keamanan" };
import { loadClubAuditList } from "@/lib/audit/load-recent-club-audit";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { parseAdminTablePage } from "@/lib/table/admin-pagination";

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};

  const from = firstString(sp.from)?.trim() ?? "";
  const to = firstString(sp.to)?.trim() ?? "";
  const action = firstString(sp.action)?.trim() ?? "";
  const userId = (firstString(sp.userId) ?? "").trim().slice(0, 200);

  const requestedPage = parseAdminTablePage(sp.page);

  const { rows, totalItems, page } = await loadClubAuditList(requestedPage, {
    from: from || undefined,
    to: to || undefined,
    action: action || undefined,
    userId: userId || undefined,
  });

  const actionOptions = Object.values(CLUB_AUDIT_ACTION).sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Keamanan</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Keamanan</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Ringkasan log audit untuk perubahan konfigurasi komite serta informasi faktor
          kedua (Better Auth).
        </p>
      </div>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold tracking-tight">Autentikasi & 2FA</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Aktivasi dan pengelolaan 2FA (TOTP, kode cadangan) dilakukan dari halaman{" "}
          <Link href="/admin/account" className="underline underline-offset-4">
            Akun
          </Link>
          . Verifikasi tambahan dengan kode email pada saat masuk hanya aktif jika pengiriman
          email transaksional telah dikonfigurasi di lingkungan server. Dokumentasi Better
          Auth:{" "}
          <a
            href="https://www.better-auth.com/docs/plugins/two-factor"
            className="underline underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            better-auth.com/docs/plugins/two-factor
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Log audit</h2>
        <p className="text-muted-foreground text-sm">
          Paginasi 10 entri per halaman. Filter waktu memakai tanggal dan jam lokal
          (kalender + field waktu); batas filter disimpan sebagai momen absolut (ISO) dan
          dibandingkan ke stempel waktu di basis data. Metadata disanitasi; tidak berisi
          isi penuh templat WhatsApp.
        </p>
        <ClubAuditLogSection
          rows={rows}
          totalItems={totalItems}
          page={page}
          filters={{ from, to, action, userId }}
          actionOptions={actionOptions}
        />
      </section>
    </div>
  );
}
