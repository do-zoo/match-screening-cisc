import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

const ROLE_LABELS: Record<string, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

export default async function CommitteeSettingsPage() {
  const profiles = await prisma.adminProfile.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      authUserId: true,
      role: true,
      member: {
        select: { memberNumber: true, fullName: true },
      },
    },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.authUserId) } },
    select: { id: true, email: true, name: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Komite & admin</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Komite & admin aplikasi</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          <strong className="text-foreground">Sumber kebenaran tunggal</strong> untuk mengatur siapa
          boleh menjadi PIC (<code className="text-foreground">canBePIC</code>), rekening bank PIC,
          dan data master anggota lainnya adalah halaman{" "}
          <Link href="/admin/members" className="font-medium text-foreground underline">
            Anggota
          </Link>
          . Halaman ini memberikan konteks dan ringkasan admin tanpa menduplikasi formulir rekening.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Admin terdaftar</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Member terkait</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Belum ada AdminProfile.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => {
                  const u = userById.get(p.authUserId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs sm:text-sm">
                        {u?.email ?? p.authUserId}
                      </TableCell>
                      <TableCell>{u?.name ?? "—"}</TableCell>
                      <TableCell>{ROLE_LABELS[p.role] ?? p.role}</TableCell>
                      <TableCell>
                        {p.member
                          ? `${p.member.memberNumber} — ${p.member.fullName}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Menambah atau mengubah peran admin saat ini memakai alur bootstrap (
          <code className="text-xs">pnpm bootstrap:admin</code>) hingga modul pengelolaan admin
          interaktif hadir di roadmap.
        </p>
      </section>
    </div>
  );
}
