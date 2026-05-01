import Link from "next/link";

import { ClubAuditLogTable } from "@/components/admin/club-audit-log-table";
import { loadRecentClubAuditForOwnerSettings } from "@/lib/audit/load-recent-club-audit";

export default async function SecuritySettingsPage() {
  const rows = await loadRecentClubAuditForOwnerSettings();

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
          Plugin <strong>twoFactor</strong> Better Auth telah diaktifkan di server —
          enrol TOTP/OTP dan halaman verifikasi penuh masih dapat ditambahkan. Mulai dari{" "}
          <Link href="/admin/account" className="underline underline-offset-4">
            Akun
          </Link>{" "}
          untuk nama tampilan. Dokumentasi resmi:{" "}
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
          100 entri terbaru (UTC). Metadata disanitasi; tidak berisi isi penuh templat
          WhatsApp.
        </p>
        <ClubAuditLogTable rows={rows} />
      </section>
    </div>
  );
}
