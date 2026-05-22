import { prisma } from "@/lib/db/prisma";
import { formatIdr } from "../utils/format-idr";

function escapeCsv(v: string): string {
  if (
    v.includes(",") ||
    v.includes('"') ||
    v.includes("\n") ||
    v.includes("\r")
  ) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** CSV UTF-8: satu baris per `Registration`, kolom holder dinamis sesuai ticketQty maksimal. */
export async function generateRegistrationsCsv(
  eventId: string,
): Promise<string> {
  const rows = await prisma.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      contactName: true,
      contactWhatsapp: true,
      ticketQty: true,
      ticketCategory: { select: { name: true } },
      status: true,
      attendanceStatus: true,
      computedTotalAtSubmit: true,
      holders: {
        orderBy: { sortOrder: "asc" },
        select: {
          holderName: true,
          claimedMemberNumber: true,
          memberValidation: true,
          ticketPriceApplied: true,
        },
      },
      adjustments: {
        select: { type: true, amount: true, status: true },
      },
    },
  });

  const maxHolders = rows.reduce(
    (max, r) => Math.max(max, r.holders.length),
    0,
  );

  const holderHeaders: string[] = [];
  for (let n = 1; n <= maxHolders; n++) {
    holderHeaders.push(
      `Holder ${n} Nama`,
      `Holder ${n} Member`,
      `Holder ${n} Status Member`,
      `Holder ${n} Harga (IDR)`,
    );
  }

  const headers = [
    "Registration ID",
    "Tanggal daftar",
    "Kategori Tiket",
    "Jumlah Tiket",
    "Nama Kontak",
    "No. WA Kontak",
    "Status",
    "Kehadiran",
    "Total (IDR)",
    "Penyesuaian (IDR)",
    ...holderHeaders,
  ];

  const body = rows.map((r) => {
    const adjustmentTotal = r.adjustments.reduce((s, a) => s + a.amount, 0);

    const holderCols: string[] = [];
    for (let n = 0; n < maxHolders; n++) {
      const h = r.holders[n];
      if (h) {
        holderCols.push(
          h.holderName,
          h.claimedMemberNumber ?? "",
          h.memberValidation,
          formatIdr(h.ticketPriceApplied),
        );
      } else {
        holderCols.push("", "", "", "");
      }
    }

    return [
      r.id,
      new Date(r.createdAt).toLocaleString("id-ID"),
      r.ticketCategory.name,
      String(r.ticketQty),
      r.contactName,
      r.contactWhatsapp,
      r.status,
      r.attendanceStatus,
      formatIdr(r.computedTotalAtSubmit),
      adjustmentTotal > 0 ? formatIdr(adjustmentTotal) : "",
      ...holderCols,
    ]
      .map(String)
      .map(escapeCsv)
      .join(",");
  });

  return [headers.map(escapeCsv).join(","), ...body].join("\r\n");
}
