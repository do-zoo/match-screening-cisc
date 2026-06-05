import { EmailTemplateKey } from '@prisma/client'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { newBlockId } from '@/lib/email-templates/email-block-types'
import { plainTextToEmailDoc } from '@/lib/email-templates/email-doc-serializer'

export type EmailTokenMeta = {
  labelId: string
  descriptionId?: string
  sampleValue: string
}

export type EmailTemplateCatalogEntry = {
  labelId: string
  descriptionId: string
  triggerDescriptionId: string
  isSystemTemplate?: boolean
  sortOrder: number
  defaultSubject: string
  defaultBlocks: EmailBlock[]
  requiredTokens: readonly string[]
  optionalTokens: readonly string[]
  tokenMeta: Record<string, EmailTokenMeta>
}

export const EMAIL_SHARED_TOKEN_META: Record<string, EmailTokenMeta> = {
  contact_name: {
    labelId: 'Nama kontak',
    sampleValue: 'Budi Santoso',
  },
  event_title: {
    labelId: 'Judul acara',
    sampleValue: 'Gala Dinner 2026',
  },
  adjustment_amount_idr: {
    labelId: 'Nominal kekurangan (IDR)',
    sampleValue: 'Rp150.000',
  },
  total_amount_idr: {
    labelId: 'Total tagihan (IDR)',
    sampleValue: 'Rp850.000',
  },
  computed_total_idr: {
    labelId: 'Total terverifikasi (IDR)',
    descriptionId: 'Nominal snapshot saat submit, diverifikasi panitia',
    sampleValue: 'Rp850.000',
  },
  ticket_qty: {
    labelId: 'Jumlah tiket',
    sampleValue: '2',
  },
  ticket_category_name: {
    labelId: 'Kategori tiket',
    sampleValue: 'VIP',
  },
  venue: {
    labelId: 'Venue',
    sampleValue: 'Gedung Serbaguna CISC',
  },
  start_at_formatted: {
    labelId: 'Waktu kick-off',
    sampleValue: '1 Juli 2026, 14.00',
  },
  open_gate_at_formatted: {
    labelId: 'Waktu buka gate',
    sampleValue: '1 Juli 2026, 12.00',
  },
  bank_name: {
    labelId: 'Nama bank',
    sampleValue: 'BCA',
  },
  account_number: {
    labelId: 'No. rekening',
    sampleValue: '1234567890',
  },
  account_name: {
    labelId: 'Atas nama rekening',
    sampleValue: 'CISC Bendahara',
  },
  registration_id: {
    labelId: 'ID registrasi',
    sampleValue: 'clxyz123abc',
  },
  club_name_nav: {
    labelId: 'Nama klub (navigasi)',
    sampleValue: 'CISC',
  },
  magic_link_url: {
    labelId: 'URL magic link',
    descriptionId: 'Hanya dipakai di tombol CTA saat render',
    sampleValue: 'https://example.com/admin/sign-in/magic?token=…',
  },
  reason: {
    labelId: 'Alasan',
    descriptionId: 'Alasan penolakan atau kendala pembayaran dari admin',
    sampleValue: 'Bukti transfer kurang jelas',
  },
  invite_url: {
    labelId: 'URL undangan admin',
    sampleValue: 'https://example.com/admin/invite/abc',
  },
  role_label: {
    labelId: 'Peran admin',
    sampleValue: 'Verifier',
  },
  otp_code: {
    labelId: 'Kode OTP',
    sampleValue: '123456',
  },
}

function paragraphBlock(text: string): EmailBlock {
  return { type: 'paragraph', id: newBlockId(), doc: plainTextToEmailDoc(text) }
}

const INVOICE_UNDERPAYMENT_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    ['Halo {contact_name},', '', 'Terdapat kekurangan pembayaran untuk {event_title} sebesar {adjustment_amount_idr}.'].join(
      '\n',
    ),
  ),
  { type: 'invoice_summary', id: newBlockId() },
  { type: 'bank_details', id: newBlockId() },
  paragraphBlock('Setelah transfer, unggah bukti pembayaran melalui panitia.'),
]

const REGISTRATION_INVOICE_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    [
      'Halo {contact_name},',
      '',
      'Berikut tagihan pendaftaran Anda untuk {event_title} sebesar {total_amount_idr}.',
    ].join('\n'),
  ),
  { type: 'invoice_summary', id: newBlockId() },
  { type: 'bank_details', id: newBlockId() },
  paragraphBlock('Setelah transfer, unggah bukti pembayaran melalui panitia.'),
]

const MAGIC_LINK_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    'Klik tombol di bawah untuk masuk ke halaman admin Match Screening. Link ini hanya berlaku sekali dan akan kedaluwarsa dalam 5 menit.',
  ),
  { type: 'cta_button', id: newBlockId(), label: 'Masuk sekarang' },
  {
    type: 'footer_disclaimer',
    id: newBlockId(),
    text: 'Jika Anda tidak meminta link ini, abaikan email ini.',
  },
]

const RECEIPT_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    [
      'Halo {contact_name},',
      '',
      'Terima kasih — pendaftaran untuk {event_title} sudah kami terima.',
      'ID: {registration_id}',
      'Total (snapshot): {computed_total_idr}',
      'Status: menunggu verifikasi admin.',
    ].join('\n'),
  ),
  {
    type: 'footer_disclaimer',
    id: newBlockId(),
    text: 'Simpan email ini sebagai referensi. Panitia akan menghubungi Anda bila diperlukan.',
  },
]

const REJECTED_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    ['Halo {contact_name},', '', 'Mohon maaf, pendaftaran untuk {event_title} belum dapat kami proses.', '', 'Alasan:', '{reason}'].join(
      '\n',
    ),
  ),
  {
    type: 'footer_disclaimer',
    id: newBlockId(),
    text: 'Jika ada pertanyaan, hubungi panitia acara.',
  },
]

const PAYMENT_ISSUE_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    [
      'Halo {contact_name},',
      '',
      'Kami perlu klarifikasi terkait bukti transfer untuk {event_title}:',
      '{reason}',
      '',
      'Mohon balas atau unggah ulang bukti sesuai arahan panitia.',
    ].join('\n'),
  ),
]

const CANCELLED_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    [
      'Halo {contact_name},',
      '',
      'Kami informasikan bahwa pendaftaran Anda untuk {event_title} telah dibatalkan.',
      '',
      'Jika ada pertanyaan, silakan hubungi panitia.',
    ].join('\n'),
  ),
]

const REFUNDED_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    [
      'Halo {contact_name},',
      '',
      'Pembayaran Anda untuk {event_title} telah dikembalikan (refunded).',
      '',
      'Mohon konfirmasi penerimaan. Terima kasih.',
    ].join('\n'),
  ),
]

const ADMIN_INVITE_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock('Anda diundang sebagai {role_label} di Match Screening. Klik tombol di bawah untuk menyelesaikan pengaturan akun.'),
  { type: 'cta_button', id: newBlockId(), label: 'Terima undangan' },
  {
    type: 'footer_disclaimer',
    id: newBlockId(),
    text: 'Tautan ini terbatas dan hanya berlaku sekali pakai.',
  },
]

const OTP_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(['Kode OTP Anda untuk masuk admin Match Screening:', '', '{otp_code}', '', 'Kode berlaku singkat. Jangan bagikan kepada siapa pun.'].join('\n')),
  {
    type: 'footer_disclaimer',
    id: newBlockId(),
    text: 'Jika Anda tidak meminta kode ini, abaikan email ini.',
  },
]

const REGISTRATION_APPROVED_DEFAULT_BLOCKS: EmailBlock[] = [
  paragraphBlock(
    [
      'Halo {contact_name},',
      '',
      'Pembayaran Anda untuk *{event_title}* telah kami verifikasi. Pendaftaran Anda disetujui.',
      '',
      'Berikut ringkasan resmi pendaftaran Anda:',
    ].join('\n').replace(/\*/g, ''),
  ),
  { type: 'registration_receipt', id: newBlockId() },
  {
    type: 'footer_disclaimer',
    id: newBlockId(),
    text: 'Simpan email ini sebagai bukti pendaftaran. Jika ada pertanyaan, hubungi panitia.',
  },
]

export const EMAIL_TEMPLATE_CATALOG: Record<EmailTemplateKey, EmailTemplateCatalogEntry> = {
  [EmailTemplateKey.invoice]: {
    labelId: 'Tagihan registrasi',
    descriptionId:
      'Email tagihan total pendaftaran ke peserta (nominal saat submit). Cocok untuk pengingat pembayaran atau konfirmasi transfer.',
    triggerDescriptionId: 'Kirim manual atau blast tagihan pendaftaran (tanpa penyesuaian kekurangan).',
    sortOrder: 1,
    defaultSubject: 'Tagihan pendaftaran — {event_title}',
    defaultBlocks: REGISTRATION_INVOICE_DEFAULT_BLOCKS,
    requiredTokens: [
      'contact_name',
      'event_title',
      'total_amount_idr',
      'bank_name',
      'account_number',
      'account_name',
    ],
    optionalTokens: ['registration_id'],
    tokenMeta: {
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      total_amount_idr: EMAIL_SHARED_TOKEN_META.total_amount_idr,
      bank_name: EMAIL_SHARED_TOKEN_META.bank_name,
      account_number: EMAIL_SHARED_TOKEN_META.account_number,
      account_name: EMAIL_SHARED_TOKEN_META.account_name,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
    },
  },
  [EmailTemplateKey.invoice_underpayment]: {
    labelId: 'Tagihan kekurangan bayar',
    descriptionId:
      'Email tagihan kekurangan bayar ke peserta. Dipakai saat blast invoice dan kirim tunggal dari operasi registrasi.',
    triggerDescriptionId: 'Kirim manual atau blast kekurangan dari tab Operasi.',
    sortOrder: 2,
    defaultSubject: 'Tagihan kekurangan — {event_title}',
    defaultBlocks: INVOICE_UNDERPAYMENT_DEFAULT_BLOCKS,
    requiredTokens: [
      'contact_name',
      'event_title',
      'adjustment_amount_idr',
      'bank_name',
      'account_number',
      'account_name',
    ],
    optionalTokens: ['registration_id'],
    tokenMeta: {
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      adjustment_amount_idr: EMAIL_SHARED_TOKEN_META.adjustment_amount_idr,
      bank_name: EMAIL_SHARED_TOKEN_META.bank_name,
      account_number: EMAIL_SHARED_TOKEN_META.account_number,
      account_name: EMAIL_SHARED_TOKEN_META.account_name,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
    },
  },
  [EmailTemplateKey.registration_approved]: {
    labelId: 'Konfirmasi pembayaran',
    descriptionId:
      'Bukti resmi pendaftaran setelah pembayaran diverifikasi. Dikirim otomatis saat admin menyetujui registrasi (jika email kontak terisi).',
    triggerDescriptionId: 'Otomatis saat approve (pref) atau kirim ulang manual.',
    sortOrder: 3,
    defaultSubject: 'Pembayaran diterima — {event_title}',
    defaultBlocks: REGISTRATION_APPROVED_DEFAULT_BLOCKS,
    requiredTokens: ['contact_name', 'event_title', 'registration_id', 'computed_total_idr'],
    optionalTokens: [
      'ticket_qty',
      'ticket_category_name',
      'venue',
      'start_at_formatted',
      'open_gate_at_formatted',
    ],
    tokenMeta: {
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
      computed_total_idr: EMAIL_SHARED_TOKEN_META.computed_total_idr,
      ticket_qty: EMAIL_SHARED_TOKEN_META.ticket_qty,
      ticket_category_name: EMAIL_SHARED_TOKEN_META.ticket_category_name,
      venue: EMAIL_SHARED_TOKEN_META.venue,
      start_at_formatted: EMAIL_SHARED_TOKEN_META.start_at_formatted,
      open_gate_at_formatted: EMAIL_SHARED_TOKEN_META.open_gate_at_formatted,
    },
  },
  [EmailTemplateKey.receipt]: {
    labelId: 'Penerimaan pendaftaran',
    descriptionId: 'Konfirmasi bahwa formulir pendaftaran telah diterima sistem.',
    triggerDescriptionId: 'Otomatis setelah submit publik jika diaktifkan di Notifikasi.',
    sortOrder: 4,
    defaultSubject: 'Pendaftaran diterima — {event_title}',
    defaultBlocks: RECEIPT_DEFAULT_BLOCKS,
    requiredTokens: ['contact_name', 'event_title', 'registration_id', 'computed_total_idr'],
    optionalTokens: ['ticket_qty', 'ticket_category_name'],
    tokenMeta: {
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
      computed_total_idr: EMAIL_SHARED_TOKEN_META.computed_total_idr,
      ticket_qty: EMAIL_SHARED_TOKEN_META.ticket_qty,
      ticket_category_name: EMAIL_SHARED_TOKEN_META.ticket_category_name,
    },
  },
  [EmailTemplateKey.rejected]: {
    labelId: 'Ditolak',
    descriptionId: 'Notifikasi penolakan registrasi dengan alasan admin.',
    triggerDescriptionId: 'Setelah tolak registrasi (dialog atau otomatis).',
    sortOrder: 5,
    defaultSubject: 'Pendaftaran belum disetujui — {event_title}',
    defaultBlocks: REJECTED_DEFAULT_BLOCKS,
    requiredTokens: ['reason'],
    optionalTokens: ['contact_name', 'event_title', 'registration_id'],
    tokenMeta: {
      reason: EMAIL_SHARED_TOKEN_META.reason,
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
    },
  },
  [EmailTemplateKey.payment_issue]: {
    labelId: 'Masalah pembayaran',
    descriptionId: 'Permintaan klarifikasi bukti transfer.',
    triggerDescriptionId: 'Setelah status payment issue (dialog atau otomatis).',
    sortOrder: 6,
    defaultSubject: 'Klarifikasi pembayaran — {event_title}',
    defaultBlocks: PAYMENT_ISSUE_DEFAULT_BLOCKS,
    requiredTokens: ['reason'],
    optionalTokens: ['contact_name', 'event_title', 'registration_id', 'computed_total_idr'],
    tokenMeta: {
      reason: EMAIL_SHARED_TOKEN_META.reason,
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
      computed_total_idr: EMAIL_SHARED_TOKEN_META.computed_total_idr,
    },
  },
  [EmailTemplateKey.cancelled]: {
    labelId: 'Dibatalkan',
    descriptionId: 'Pemberitahuan pembatalan registrasi.',
    triggerDescriptionId: 'Setelah cancel registrasi (dialog atau otomatis).',
    sortOrder: 7,
    defaultSubject: 'Pendaftaran dibatalkan — {event_title}',
    defaultBlocks: CANCELLED_DEFAULT_BLOCKS,
    requiredTokens: ['contact_name', 'event_title'],
    optionalTokens: ['registration_id', 'ticket_qty'],
    tokenMeta: {
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
      ticket_qty: EMAIL_SHARED_TOKEN_META.ticket_qty,
    },
  },
  [EmailTemplateKey.refunded]: {
    labelId: 'Refunded',
    descriptionId: 'Pemberitahuan pengembalian dana.',
    triggerDescriptionId: 'Setelah refund registrasi (dialog atau otomatis).',
    sortOrder: 8,
    defaultSubject: 'Pengembalian dana — {event_title}',
    defaultBlocks: REFUNDED_DEFAULT_BLOCKS,
    requiredTokens: ['contact_name', 'event_title'],
    optionalTokens: ['registration_id', 'computed_total_idr'],
    tokenMeta: {
      contact_name: EMAIL_SHARED_TOKEN_META.contact_name,
      event_title: EMAIL_SHARED_TOKEN_META.event_title,
      registration_id: EMAIL_SHARED_TOKEN_META.registration_id,
      computed_total_idr: EMAIL_SHARED_TOKEN_META.computed_total_idr,
    },
  },
  [EmailTemplateKey.magic_link]: {
    labelId: 'Magic link masuk admin',
    descriptionId: 'Email magic link untuk masuk admin. URL hanya di tombol CTA, bukan di paragraf.',
    triggerDescriptionId: 'Otomatis saat admin meminta magic link masuk.',
    isSystemTemplate: true,
    sortOrder: 9,
    defaultSubject: 'Link masuk Match Screening',
    defaultBlocks: MAGIC_LINK_DEFAULT_BLOCKS,
    requiredTokens: [],
    optionalTokens: ['club_name_nav'],
    tokenMeta: {
      club_name_nav: EMAIL_SHARED_TOKEN_META.club_name_nav,
      magic_link_url: EMAIL_SHARED_TOKEN_META.magic_link_url,
    },
  },
  [EmailTemplateKey.admin_invite]: {
    labelId: 'Undangan admin',
    descriptionId: 'Email undangan onboarding admin baru.',
    triggerDescriptionId: 'Otomatis saat Owner membuat undangan admin.',
    isSystemTemplate: true,
    sortOrder: 10,
    defaultSubject: 'Undangan admin Match Screening',
    defaultBlocks: ADMIN_INVITE_DEFAULT_BLOCKS,
    requiredTokens: ['role_label'],
    optionalTokens: ['invite_url'],
    tokenMeta: {
      role_label: EMAIL_SHARED_TOKEN_META.role_label,
      invite_url: EMAIL_SHARED_TOKEN_META.invite_url,
    },
  },
  [EmailTemplateKey.otp]: {
    labelId: 'Kode OTP 2FA',
    descriptionId: 'Kode sekali pakai untuk verifikasi dua faktor saat masuk admin.',
    triggerDescriptionId: 'Otomatis saat admin meminta kode OTP email.',
    isSystemTemplate: true,
    sortOrder: 11,
    defaultSubject: 'Kode OTP Match Screening',
    defaultBlocks: OTP_DEFAULT_BLOCKS,
    requiredTokens: ['otp_code'],
    optionalTokens: [],
    tokenMeta: {
      otp_code: EMAIL_SHARED_TOKEN_META.otp_code,
    },
  },
}

export const EMAIL_TEMPLATE_KEYS_ORDERED = (
  Object.values(EmailTemplateKey).filter(v => typeof v === 'string') as EmailTemplateKey[]
).toSorted((a, b) => EMAIL_TEMPLATE_CATALOG[a].sortOrder - EMAIL_TEMPLATE_CATALOG[b].sortOrder)

export function getEmailTemplateEntry(key: EmailTemplateKey): EmailTemplateCatalogEntry {
  return EMAIL_TEMPLATE_CATALOG[key]
}

export function allowedTokensForKey(key: EmailTemplateKey): string[] {
  const entry = getEmailTemplateEntry(key)
  return [...entry.requiredTokens, ...entry.optionalTokens]
}

export function allTokensForKey(key: EmailTemplateKey): Set<string> {
  return new Set(allowedTokensForKey(key))
}

export function sampleVarsFromCatalog(entry: EmailTemplateCatalogEntry): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [token, meta] of Object.entries(entry.tokenMeta)) {
    vars[token] = meta.sampleValue
  }
  for (const token of entry.requiredTokens) {
    if (!(token in vars) && entry.tokenMeta[token]) {
      vars[token] = entry.tokenMeta[token]!.sampleValue
    }
  }
  return vars
}
