import { prisma } from "@/lib/db/prisma";
import { TicketRole } from "@prisma/client";
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

/** CSV UTF-8: satu baris per `Registration` (utama atau partner). */
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
      claimedMemberNumber: true,
      memberValidation: true,
      ticketRole: true,
      primaryRegistrationId: true,
      primaryRegistration: {
        select: { id: true, contactName: true },
      },
      status: true,
      attendanceStatus: true,
      ticketPriceApplied: true,
      mandatoryMenuPriceApplied: true,
      computedTotalAtSubmit: true,
      mandatoryMenuItem: { select: { name: true } },
      adjustments: {
        select: { type: true, amount: true, status: true },
      },
    },
  });

  const headers = [
    "ID",
    "Tanggal daftar",
    "Nama pendaftar",
    "WhatsApp",
    "No. member",
    "Peran",
    "Pembeli utama (jika partner)",
    "Validasi member",
    "Status",
    "Kehadiran",
    "Harga tiket (IDR)",
    "Menu wajib",
    "Harga acuan menu wajib (IDR)",
    "Total (IDR)",
    "Penyesuaian (IDR)",
  ];

  const body = rows.map((r) => {
    const adjustmentTotal = r.adjustments.reduce((s, a) => s + a.amount, 0);
    const roleLabel = r.ticketRole === TicketRole.primary ? "Utama" : "Partner";
    const primaryBuyer =
      r.ticketRole === TicketRole.partner && r.primaryRegistration
        ? r.primaryRegistration.contactName
        : "";

    return [
      r.id,
      new Date(r.createdAt).toLocaleString("id-ID"),
      r.contactName,
      r.contactWhatsapp,
      r.claimedMemberNumber ?? "",
      roleLabel,
      primaryBuyer,
      r.memberValidation,
      r.status,
      r.attendanceStatus,
      formatIdr(r.ticketPriceApplied),
      r.mandatoryMenuItem.name,
      formatIdr(r.mandatoryMenuPriceApplied),
      formatIdr(r.computedTotalAtSubmit),
      adjustmentTotal > 0 ? formatIdr(adjustmentTotal) : "",
    ]
      .map(String)
      .map(escapeCsv)
      .join(",");
  });

  return [headers.map(escapeCsv).join(","), ...body].join("\r\n");
}
