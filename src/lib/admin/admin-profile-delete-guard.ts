import { prisma } from "@/lib/db/prisma";

export type AdminProfileDeletionBlockers = {
  eventPicCount: number;
  picBankAccountOwnedCount: number;
};

export async function loadAdminProfileDeletionBlockers(
  adminProfileId: string,
): Promise<AdminProfileDeletionBlockers> {
  const [eventPicCount, picBankAccountOwnedCount] = await Promise.all([
    prisma.event.count({ where: { picAdminProfileId: adminProfileId } }),
    prisma.picBankAccount.count({
      where: { ownerAdminProfileId: adminProfileId },
    }),
  ]);
  return { eventPicCount, picBankAccountOwnedCount };
}

/** Null jika boleh lanjut hapus dari sisi FK PIC/rekening. */
export function formatAdminProfileDeleteBlockedMessage(
  b: AdminProfileDeletionBlockers,
): string | null {
  if (b.eventPicCount === 0 && b.picBankAccountOwnedCount === 0) {
    return null;
  }
  const parts: string[] = [];
  if (b.eventPicCount > 0) {
    parts.push(
      `profil menjadi PIC utama pada ${b.eventPicCount} acara — pindahkan PIC acara tersebut terlebih dahulu`,
    );
  }
  if (b.picBankAccountOwnedCount > 0) {
    parts.push(
      `profil memiliki ${b.picBankAccountOwnedCount} rekening PIC terdaftar — sesuaikan kepemilikan atau nonaktifkan rekening terlebih dahulu`,
    );
  }
  return `Tidak bisa menghapus: ${parts.join("; ")}.`;
}
