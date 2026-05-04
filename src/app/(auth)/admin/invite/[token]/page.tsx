import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminInviteAcceptForm } from "@/components/admin/admin-invite-accept-form";
import { hashAdminInviteToken } from "@/lib/admin/admin-invite-crypto";
import { loadAdminInvitationForAcceptPage } from "@/lib/admin/load-admin-invitation-for-accept-page";

export const metadata: Metadata = {
  title: "Undangan admin",
  robots: { index: false, follow: false },
};

export default async function AdminInviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const raw = decodeURIComponent(token).trim();
  if (!raw) notFound();

  const tokenHash = hashAdminInviteToken(raw);
  const invite = await loadAdminInvitationForAcceptPage(tokenHash);
  if (!invite) notFound();

  if (invite.expired) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight">Undangan kedaluwarsa</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Minta Owner mengirim undangan baru dari Pengaturan → Komite & admin.
        </p>
        <Link href="/admin/sign-in" className="text-primary mt-6 underline">
          Menuju masuk admin
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Selesaikan undangan admin</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Untuk{" "}
        <span className="text-foreground font-medium">{invite.emailNormalized}</span>
      </p>
      <AdminInviteAcceptForm token={raw} />
    </main>
  );
}
