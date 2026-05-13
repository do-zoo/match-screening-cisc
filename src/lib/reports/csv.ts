import { TicketRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

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

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(n);

/** CSV UTF-8: satu baris per `Registration` (utama atau partner). */
export async function generateRegistrationsCsv(eventId: string): Promise<string> {
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
      tickets: {
        select: {
          role: true,
          fullName: true,
          memberNumber: true,
        },
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
    "Harga menu (IDR)",
    "Total (IDR)",
    "Tiket utama (legacy)",
    "Tiket partner (legacy)",
    "Penyesuaian (IDR)",
  ];

  const body = rows.map((r) => {
    const primaryLegacy = r.tickets.find((t) => t.role === TicketRole.primary);
    const partnerLegacy = r.tickets.find((t) => t.role === TicketRole.partner);
    const adjustmentTotal = r.adjustments.reduce((s, a) => s + a.amount, 0);
    const roleLabel =
      r.ticketRole === TicketRole.primary ? "Utama" : "Partner";
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
      idr(r.ticketPriceApplied),
      r.mandatoryMenuItem.name,
      idr(r.mandatoryMenuPriceApplied),
      idr(r.computedTotalAtSubmit),
      primaryLegacy?.fullName ?? "",
      partnerLegacy?.fullName ?? "",
      adjustmentTotal > 0 ? idr(adjustmentTotal) : "",
    ]
      .map(String)
      .map(escapeCsv)
      .join(",");
  });

  return [headers.map(escapeCsv).join(","), ...body].join("\r\n");
}
