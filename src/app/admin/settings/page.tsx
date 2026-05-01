import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminSettingsHubPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan komite</h1>
        <p className="text-muted-foreground text-sm">
          Konfigurasi lanjutan klub — hanya Owner. Pilih modul di atas (seluler: geser), sidebar di
          layar besar, atau kartu di bawah.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsCard
          href="/admin/settings/committee"
          title="Komite & admin"
          description="Kelola akses aplikasi dan peran (Owner/Admin/Verifier/Viewer); tautan opsional ke anggota; PIC serta rekening tetap dari Anggota."
        />
        <SettingsCard
          href="/admin/settings/pricing"
          title="Harga default"
          description="Nilai awal tiket saat acara memakai default komite."
        />
        <SettingsCard
          href="/admin/settings/whatsapp-templates"
          title="Template WhatsApp"
          description="Isi pesan untuk tautan wa.me di admin; placeholder {snake_case}; fallback ke bawaan kode."
        />
        <SettingsCard
          href="/admin/settings/branding"
          title="Branding"
          description="Judul navigasi, logo situs (WebP), dan teks footer untuk halaman publik."
        />
        <SettingsCard
          href="/admin/settings/notifications"
          title="Notifikasi"
          description="Mode saluran keluar (stub vs live) dan label internal; terpisah dari pemasangan SMTP/Resend."
        />
        <SettingsCard
          href="/admin/settings/operations"
          title="Operasional"
          description="Tutup pendaftaran situs secara global dan banner pemeliharaan untuk pengunjung."
        />
        <SettingsCard
          href="/admin/settings/security"
          title="Keamanan"
          description="Log audit konfigurasi komite dan informasi 2FA (Better Auth)."
        />
      </div>
    </div>
  );
}

function SettingsCard(props: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={props.href} className="block">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="text-base">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
