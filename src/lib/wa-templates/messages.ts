export type RegistrationMessageCtx = {
  contactName: string;
  eventTitle: string;
  registrationId: string;
  computedTotalIdr: number;
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export function templateReceipt(c: RegistrationMessageCtx): string {
  return [
    `Halo ${c.contactName},`,
    ``,
    `Terima kasih — pendaftaran untuk *${c.eventTitle}* sudah kami terima.`,
    `ID: \`${c.registrationId}\``,
    `Total (snapshot): *${idr(c.computedTotalIdr)}*`,
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
