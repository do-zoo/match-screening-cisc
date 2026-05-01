import { formatWaIdr } from "@/lib/wa-templates/format-wa-idr";

export type RegistrationMessageCtx = {
  contactName: string;
  eventTitle: string;
  registrationId: string;
  computedTotalIdr: number;
};

export function templateReceipt(c: RegistrationMessageCtx): string {
  return [
    `Halo ${c.contactName},`,
    ``,
    `Terima kasih — pendaftaran untuk *${c.eventTitle}* sudah kami terima.`,
    `ID: \`${c.registrationId}\``,
    `Total (snapshot): *${formatWaIdr(c.computedTotalIdr)}*`,
    `Status: *menunggu verifikasi admin*.`,
  ].join("\n");
}

export function templatePaymentIssue(reason: string): string {
  return [
    `Halo,`,
    ``,
    `Kami perlu klarifikasi terkait bukti transfer:`,
    reason,
    ``,
    `Mohon balas pesan ini setelah menyesuaikan / mengunggah ulang bukti sesuai arahan.`,
  ].join("\n");
}

export function templateApproved(
  eventTitle: string,
  venue: string,
  startAtIso: string,
): string {
  const when = new Date(startAtIso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short",
  });
  return [
    `Selamat — pendaftaran untuk *${eventTitle}* *disetujui*.`,
    ``,
    `Detail acara: ${venue}`,
    `Waktu: ${when}`,
  ].join("\n");
}

export function templateRejected(reason: string): string {
  return [
    `Mohon maaf, pendaftaran belum dapat kami proses.`,
    ``,
    `Alasan:`,
    reason,
  ].join("\n");
}

export function templateCancelled(contactName: string, eventTitle: string): string {
  return [
    `Halo ${contactName},`,
    ``,
    `Kami informasikan bahwa pendaftaran Anda untuk *${eventTitle}* telah *dibatalkan*.`,
    ``,
    `Jika ada pertanyaan, silakan hubungi panitia.`,
  ].join("\n");
}

export function templateRefunded(contactName: string, eventTitle: string): string {
  return [
    `Halo ${contactName},`,
    ``,
    `Pembayaran Anda untuk *${eventTitle}* telah *dikembalikan (refunded)*.`,
    ``,
    `Mohon konfirmasi penerimaan. Terima kasih.`,
  ].join("\n");
}

export type UnderpaymentInvoiceCtx = {
  contactName: string;
  eventTitle: string;
  adjustmentAmountIdr: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export function templateUnderpaymentInvoice(c: UnderpaymentInvoiceCtx): string {
  const amount = formatWaIdr(c.adjustmentAmountIdr);

  return [
    `Halo ${c.contactName},`,
    ``,
    `Terdapat kekurangan pembayaran untuk *${c.eventTitle}* sebesar *${amount}*.`,
    ``,
    `Mohon transfer ke:`,
    `Bank: *${c.bankName}*`,
    `No. Rekening: *${c.accountNumber}*`,
    `Atas nama: *${c.accountName}*`,
    ``,
    `Setelah transfer, unggah bukti pembayaran melalui panitia atau balas pesan ini.`,
  ].join("\n");
}
