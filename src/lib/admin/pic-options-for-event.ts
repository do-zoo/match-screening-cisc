import { AdminRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PicAdminOption = { id: string; label: string };

/** Daftar admin yang boleh dipilih sebagai PIC utama acara (bukan Viewer). */
export async function loadPicAdminProfileOptionsForEvents(): Promise<
  PicAdminOption[]
> {
  const profiles = await prisma.adminProfile.findMany({
    where: { role: { not: AdminRole.Viewer } },
    select: {
      id: true,
      authUserId: true,
      member: { select: { memberNumber: true } },
    },
  });
  if (profiles.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.authUserId) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const options: PicAdminOption[] = profiles.map((p) => {
    const u = userById.get(p.authUserId);
    const base =
      u?.name?.trim() || u?.email?.trim() || `admin:${p.id.slice(0, 8)}`;
    const suffix = p.member?.memberNumber
      ? ` · ${p.member.memberNumber}`
      : "";
    return { id: p.id, label: `${base}${suffix}` };
  });

  options.sort((a, b) => a.label.localeCompare(b.label, "id"));
  return options;
}

/** Member directory id (or null) for each eligible PIC admin — for helper UI (exclude double role). */
export async function loadPicAdminToMemberLinkMap(): Promise<
  Record<string, string | null>
> {
  const rows = await prisma.adminProfile.findMany({
    where: { role: { not: AdminRole.Viewer } },
    select: { id: true, memberId: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.id, r.memberId ?? null]),
  );
}
