import { notFound } from "next/navigation";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="border-t px-6 py-8">
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Modul ini menyusul — belum ada penyimpanan data.
        </div>
      </div>
    </Card>
  );
}

export default async function AdminCommitteeSettingsPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan komite</h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi lanjutan klub — PIC, rekening bank, default harga, dan template WhatsApp.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <PlaceholderPanel
          title="PIC & admin aplikasi"
          description="Mengatur siapa menjadi PIC utama, pembantu, serta hak akses admin terkait acara dan verifikasi."
        />
        <PlaceholderPanel
          title="Rekening bank & PIC"
          description="Rekening transfer yang digunakan per PIC untuk bukti pembayaran dan penugasan kartu pembayaran."
        />
        <PlaceholderPanel
          title="Harga default global"
          description="Tarif acara baru yang diusulkan sebagai nilai awal sebelum dikustom per acara."
        />
        <PlaceholderPanel
          title="Template WhatsApp"
          description="Template pesan sistem untuk menyetujui, menolak, masalah pembayaran, dan notifikasi terkait."
        />
      </div>
    </main>
  );
}
