import type { Metadata } from "next";
import Link from "next/link";

import { ClubWaTemplatesPanel } from "@/components/admin/club-wa-templates-panel";

export const metadata: Metadata = { title: "Template WhatsApp" };
import { prisma } from "@/lib/db/prisma";
import type { WaTemplateKey } from "@prisma/client";

export default async function WhatsappTemplatesSettingsPage() {
  const rows = await prisma.clubWaTemplate.findMany({
    select: { key: true, body: true },
  });

  const initialFromDb: Partial<Record<WaTemplateKey, string>> = {};
  for (const row of rows) {
    initialFromDb[row.key as WaTemplateKey] = row.body;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Template WhatsApp</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Template pesan WhatsApp
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Mengatur teks pesan pra‑isi untuk tautan dari halaman detail pendaftaran admin.
          Bila Anda belum menyimpan suatu templat atau terjadi kesalahan, aplikasi akan
          memakai perilaku bawaan yang sebelumnya dihardcode dalam kode.
        </p>
      </div>
      <ClubWaTemplatesPanel initialFromDb={initialFromDb} />
    </div>
  );
}
