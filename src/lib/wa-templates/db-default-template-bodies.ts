import type { WaTemplateKey } from "@prisma/client";

export const CLUB_WA_DEFAULT_BODIES: Record<WaTemplateKey, string> = {
  receipt: [
    `Halo {contact_name},`,
    ``,
    `Terima kasih — pendaftaran untuk *{event_title}* sudah kami terima.`,
    `ID: \`{registration_id}\``,
    `Total (snapshot): *{computed_total_idr}*`,
    `Status: *menunggu verifikasi admin*.`,
  ].join("\n"),

  payment_issue: [
    `Halo,`,
    ``,
    `Kami perlu klarifikasi terkait bukti transfer:`,
    `{reason}`,
    ``,
    `Mohon balas pesan ini setelah menyesuaikan / mengunggah ulang bukti sesuai arahan.`,
  ].join("\n"),

  approved: [
    `Selamat — pendaftaran untuk *{event_title}* *disetujui*.`,
    ``,
    `Detail acara: {venue}`,
    `Waktu: {start_at_formatted}`,
  ].join("\n"),

  rejected: [
    `Mohon maaf, pendaftaran belum dapat kami proses.`,
    ``,
    `Alasan:`,
    `{reason}`,
  ].join("\n"),

  cancelled: [
    `Halo {contact_name},`,
    ``,
    `Kami informasikan bahwa pendaftaran Anda untuk *{event_title}* telah *dibatalkan*.`,
    ``,
    `Jika ada pertanyaan, silakan hubungi panitia.`,
  ].join("\n"),

  refunded: [
    `Halo {contact_name},`,
    ``,
    `Pembayaran Anda untuk *{event_title}* telah *dikembalikan (refunded)*.`,
    ``,
    `Mohon konfirmasi penerimaan. Terima kasih.`,
  ].join("\n"),

  underpayment_invoice: [
    `Halo {contact_name},`,
    ``,
    `Terdapat kekurangan pembayaran untuk *{event_title}* sebesar *{adjustment_amount_idr}*.`,
    ``,
    `Mohon transfer ke:`,
    `Bank: *{bank_name}*`,
    `No. Rekening: *{account_number}*`,
    `Atas nama: *{account_name}*`,
    ``,
    `Setelah transfer, unggah bukti pembayaran melalui panitia atau balas pesan ini.`,
  ].join("\n"),
};
