import { EmailTemplateKey } from '@prisma/client'

export type EmailTemplateDefaults = { subject: string; body: string }

export const CLUB_EMAIL_DEFAULT_BODIES: Record<EmailTemplateKey, EmailTemplateDefaults> = {
  [EmailTemplateKey.invoice_underpayment]: {
    subject: 'Tagihan kekurangan — {event_title}',
    body: [
      'Halo {contact_name},',
      '',
      'Terdapat kekurangan pembayaran untuk {event_title} sebesar {adjustment_amount_idr}.',
      '',
      'Mohon transfer ke:',
      'Bank: {bank_name}',
      'No. Rekening: {account_number}',
      'Atas nama: {account_name}',
      '',
      'Setelah transfer, unggah bukti pembayaran melalui panitia.',
    ].join('\n'),
  },
  [EmailTemplateKey.magic_link]: {
    subject: 'Link masuk Match Screening',
    body: [
      'Klik tautan berikut untuk masuk ke halaman admin Match Screening:',
      '{magic_link_url}',
      '',
      'Link ini hanya berlaku sekali dan akan kedaluwarsa dalam 5 menit.',
      '',
      'Jika Anda tidak meminta link ini, abaikan email ini.',
    ].join('\n'),
  },
}
