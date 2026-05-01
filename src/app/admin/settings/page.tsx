import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export default async function AdminPengaturanPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan komite</h1>
        <p className="text-sm text-muted-foreground">
          Pengaturan lanjutan komite — admin PIC, rekening bank, harga default, dan template WA akan
          dikonfigurasi di sini.
        </p>
      </header>
      <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Modul pengaturan lanjutan menyusul; hanya Owner yang dapat membuka jalur ini.
      </div>
    </main>
  );
}
