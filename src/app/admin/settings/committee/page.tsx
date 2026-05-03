import type { Metadata } from "next";
import Link from "next/link";

import { CommitteeAdminSettingsPanel } from "@/components/admin/committee-admin-settings-panel";
import { loadCommitteeAdminDirectory } from "@/lib/admin/load-committee-admin-directory";
import { loadPendingAdminInvitationsForCommittee } from "@/lib/admin/load-pending-admin-invitations";

export const metadata: Metadata = { title: "Komite" };

export default async function CommitteeSettingsPage() {
  const [directory, pendingInvitations] = await Promise.all([
    loadCommitteeAdminDirectory(),
    loadPendingAdminInvitationsForCommittee(),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">
            <Link href="/admin/settings" className="underline underline-offset-4">
              Pengaturan
            </Link>
            {" / "}
            <span>Komite & admin</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Komite & admin aplikasi</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          <strong className="text-foreground">Master anggota</strong> dikelola di halaman{" "}
          <Link href="/admin/members" className="font-medium text-foreground underline">
            Anggota
          </Link>
          . <strong className="text-foreground">PIC utama acara</strong> adalah{" "}
          <strong className="text-foreground">profil admin</strong> (bukan flag di direktori);{" "}
          <strong className="text-foreground">rekening pembayaran</strong> dipasangkan ke profil admin di bawah.
          Di halaman ini yang diatur adalah{" "}
          <strong className="text-foreground">identitas akses aplikasi</strong>: peran
          Owner/Admin/Verifier/Viewer dan tautan opsional ke baris direktori anggota.
        </p>
        <div className="border-border rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
          <p className="font-medium text-foreground">Langkah biasa</p>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 ps-5">
            <li>
              Untuk admin baru, gunakan <strong className="text-foreground">Undang admin baru</strong> —
              orang tersebut menerima taut onboarding (email bisa dikirim otomatis bila SMTP aktif).
            </li>
            <li>
              Untuk orang yang sudah punya akun pengguna tetapi belum ada profil admin, pakai{" "}
              <strong className="text-foreground">Tautkan akun ada</strong> dengan email tersebut.
            </li>
            <li>Pastikan direktori anggota dan (bila perlu) rekening PIC di profil admin sudah siap sebelum PIC acara.</li>
            <li>Gunakan{" "}
              <Link href="/admin/settings/security" className="underline underline-offset-4">
                Keamanan
              </Link>{" "}
              untuk log audit konfigurasi.</li>
          </ol>
        </div>
      </div>

      <CommitteeAdminSettingsPanel
        directory={directory}
        pendingInvitations={pendingInvitations}
      />
    </div>
  );
}
