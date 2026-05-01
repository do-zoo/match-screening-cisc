import { TicketRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Returns a UTF-8 CSV string of all registrations for an event. */
export async function generateRegistrationsCsv(eventId: string): Promise<string> {
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      contactName: true,
      contactWhatsapp: true,
      claimedMemberNumber: true,
      memberValidation: true,
      status: true,
      attendanceStatus: true,
      computedTotalAtSubmit: true,
      tickets: {
        select: {
          role: true,
          fullName: true,
          whatsapp: true,
          memberNumber: true,
          ticketPriceType: true,
          voucherRedeemedMenuItemId: true,
          menuSelections: {
            select: { menuItem: { select: { name: true } } },
          },
        },
      },
      adjustments: {
        select: { type: true, amount: true, status: true },
      },
    },
  });

  const idr = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "decimal", maximumFractionDigits: 0 }).format(n);

  const headers = [
    "ID",
    "Tanggal daftar",
    "Nama kontak",
    "WhatsApp",
    "No. member",
    "Validasi member",
    "Status",
    "Kehadiran",
    "Total (IDR)",
    "Tiket utama",
    "Menu tiket utama",
    "Tiket partner",
    "Menu tiket partner",
    "Penyesuaian (IDR)",
  ];

  function escapeCsv(v: string): string {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }

  const rows = registrations.map((r) => {
    const primary = r.tickets.find((t) => t.role === TicketRole.primary);
    const partner = r.tickets.find((t) => t.role === TicketRole.partner);
    const primaryMenu = primary?.menuSelections.map((s) => s.menuItem.name).join("; ") ?? "";
    const partnerMenu = partner?.menuSelections.map((s) => s.menuItem.name).join("; ") ?? "";
    const adjustmentTotal = r.adjustments.reduce((s, a) => s + a.amount, 0);

    return [
      r.id,
      new Date(r.createdAt).toLocaleDateString("id-ID"),
      r.contactName,
      r.contactWhatsapp,
      r.claimedMemberNumber ?? "",
      r.memberValidation,
      r.status,
      r.attendanceStatus,
      idr(r.computedTotalAtSubmit),
      primary?.fullName ?? "",
      primaryMenu,
      partner?.fullName ?? "",
      partnerMenu,
      adjustmentTotal > 0 ? idr(adjustmentTotal) : "",
    ]
      .map(String)
      .map(escapeCsv)
      .join(",");
  });

  return [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
}
