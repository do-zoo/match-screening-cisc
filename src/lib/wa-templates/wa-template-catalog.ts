import { WaTemplateKey } from '@prisma/client'

export type WaTemplateCategory = 'pendaftaran' | 'verifikasi' | 'operasi'

export type WaTokenMeta = {
  labelId: string
  descriptionId?: string
  sampleValue: string
}

export type WaTemplateCatalogEntry = {
  labelId: string
  descriptionId: string
  category: WaTemplateCategory
  sortOrder: number
  defaultBody: string
  requiredTokens: readonly string[]
  optionalTokens: readonly string[]
  tokenMeta: Record<string, WaTokenMeta>
}

export const SHARED_TOKEN_META: Record<string, WaTokenMeta> = {
  contact_name: {
    labelId: 'Nama kontak',
    descriptionId: 'Nama pemesan utama registrasi',
    sampleValue: 'Budi Santoso',
  },
  contact_whatsapp: {
    labelId: 'WhatsApp kontak',
    descriptionId: 'Nomor WhatsApp pemesan',
    sampleValue: '6281234567890',
  },
  event_title: {
    labelId: 'Judul acara',
    sampleValue: 'Nobar Final Liga',
  },
  registration_id: {
    labelId: 'ID registrasi',
    sampleValue: 'clxyz123abc',
  },
  computed_total_idr: {
    labelId: 'Total bayar (IDR)',
    sampleValue: 'Rp150.000',
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
    descriptionId: 'Tanggal dan jam mulai acara (WIB)',
    sampleValue: '1 Juli 2026, 14.00',
  },
  open_gate_at_formatted: {
    labelId: 'Waktu buka gate',
    descriptionId: 'Tanggal dan jam buka pintu masuk (WIB)',
    sampleValue: '1 Juli 2026, 12.00',
  },
  reason: {
    labelId: 'Alasan',
    descriptionId: 'Alasan penolakan atau kendala pembayaran dari admin',
    sampleValue: 'Bukti transfer kurang jelas',
  },
  adjustment_amount_idr: {
    labelId: 'Nominal kekurangan (IDR)',
    sampleValue: 'Rp50.000',
  },
  bank_name: {
    labelId: 'Nama bank',
    sampleValue: 'BCA',
  },
  account_number: {
    labelId: 'Nomor rekening',
    sampleValue: '1234567890',
  },
  account_name: {
    labelId: 'Atas nama rekening',
    sampleValue: 'CISC Tangsel',
  },
}

function pickTokenMeta(tokens: readonly string[]): Record<string, WaTokenMeta> {
  const out: Record<string, WaTokenMeta> = {}
  for (const t of tokens) {
    const meta = SHARED_TOKEN_META[t]
    if (meta) out[t] = meta
  }
  return out
}

function entry(
  partial: Omit<WaTemplateCatalogEntry, 'tokenMeta'> & { tokenMeta?: Record<string, WaTokenMeta> },
): WaTemplateCatalogEntry {
  const allTokens = [...partial.requiredTokens, ...partial.optionalTokens]
  return {
    ...partial,
    tokenMeta: partial.tokenMeta ?? pickTokenMeta(allTokens),
  }
}

export const WA_TEMPLATE_CATALOG: Record<WaTemplateKey, WaTemplateCatalogEntry> = {
  [WaTemplateKey.receipt]: entry({
    labelId: 'Penerimaan pendaftaran',
    descriptionId: 'Dikirim setelah peserta submit form (referensi internal; belum dipakai dialog wa.me).',
    category: 'pendaftaran',
    sortOrder: 10,
    defaultBody: [
      `Halo {contact_name},`,
      ``,
      `Terima kasih — pendaftaran untuk *{event_title}* sudah kami terima.`,
      `ID: \`{registration_id}\``,
      `Total (snapshot): *{computed_total_idr}*`,
      `Status: *menunggu verifikasi admin*.`,
    ].join('\n'),
    requiredTokens: ['contact_name', 'event_title', 'registration_id', 'computed_total_idr'],
    optionalTokens: ['ticket_qty', 'ticket_category_name', 'contact_whatsapp', 'venue'],
  }),

  [WaTemplateKey.approved]: entry({
    labelId: 'Disetujui',
    descriptionId: 'Tautan wa.me setelah admin menyetujui registrasi.',
    category: 'verifikasi',
    sortOrder: 20,
    defaultBody: [
      `Selamat — pendaftaran untuk *{event_title}* *disetujui*.`,
      ``,
      `Detail acara: {venue}`,
      `Waktu: {start_at_formatted}`,
    ].join('\n'),
    requiredTokens: ['event_title', 'venue', 'start_at_formatted'],
    optionalTokens: [
      'contact_name',
      'registration_id',
      'ticket_qty',
      'ticket_category_name',
      'open_gate_at_formatted',
    ],
  }),

  [WaTemplateKey.rejected]: entry({
    labelId: 'Ditolak',
    descriptionId: 'Tautan wa.me setelah registrasi ditolak (wajib isi alasan).',
    category: 'verifikasi',
    sortOrder: 30,
    defaultBody: [`Mohon maaf, pendaftaran belum dapat kami proses.`, ``, `Alasan:`, `{reason}`].join('\n'),
    requiredTokens: ['reason'],
    optionalTokens: ['contact_name', 'event_title', 'registration_id'],
  }),

  [WaTemplateKey.payment_issue]: entry({
    labelId: 'Masalah pembayaran',
    descriptionId: 'Tautan wa.me untuk kendala bukti transfer (wajib isi alasan).',
    category: 'verifikasi',
    sortOrder: 40,
    defaultBody: [
      `Halo,`,
      ``,
      `Kami perlu klarifikasi terkait bukti transfer:`,
      `{reason}`,
      ``,
      `Mohon balas pesan ini setelah menyesuaikan / mengunggah ulang bukti sesuai arahan.`,
    ].join('\n'),
    requiredTokens: ['reason'],
    optionalTokens: ['contact_name', 'event_title', 'registration_id', 'computed_total_idr'],
  }),

  [WaTemplateKey.cancelled]: entry({
    labelId: 'Dibatalkan',
    descriptionId: 'Tautan wa.me setelah registrasi dibatalkan.',
    category: 'operasi',
    sortOrder: 50,
    defaultBody: [
      `Halo {contact_name},`,
      ``,
      `Kami informasikan bahwa pendaftaran Anda untuk *{event_title}* telah *dibatalkan*.`,
      ``,
      `Jika ada pertanyaan, silakan hubungi panitia.`,
    ].join('\n'),
    requiredTokens: ['contact_name', 'event_title'],
    optionalTokens: ['registration_id', 'ticket_qty'],
  }),

  [WaTemplateKey.refunded]: entry({
    labelId: 'Refunded',
    descriptionId: 'Tautan wa.me setelah pengembalian dana.',
    category: 'operasi',
    sortOrder: 60,
    defaultBody: [
      `Halo {contact_name},`,
      ``,
      `Pembayaran Anda untuk *{event_title}* telah *dikembalikan (refunded)*.`,
      ``,
      `Mohon konfirmasi penerimaan. Terima kasih.`,
    ].join('\n'),
    requiredTokens: ['contact_name', 'event_title'],
    optionalTokens: ['registration_id', 'computed_total_idr'],
  }),

  [WaTemplateKey.underpayment_invoice]: entry({
    labelId: 'Tagihan kekurangan bayar',
    descriptionId: 'Pesan WA manual untuk tagihan kekurangan (selain email invoice).',
    category: 'operasi',
    sortOrder: 70,
    defaultBody: [
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
    ].join('\n'),
    requiredTokens: [
      'contact_name',
      'event_title',
      'adjustment_amount_idr',
      'bank_name',
      'account_number',
      'account_name',
    ],
    optionalTokens: ['registration_id', 'computed_total_idr'],
  }),
}

export const WA_TEMPLATE_KEYS_ORDERED = (
  Object.values(WaTemplateKey).filter(v => typeof v === 'string') as WaTemplateKey[]
).toSorted((a, b) => WA_TEMPLATE_CATALOG[a].sortOrder - WA_TEMPLATE_CATALOG[b].sortOrder)

export function isWaTemplateKey(value: string): value is WaTemplateKey {
  return (Object.values(WaTemplateKey) as string[]).includes(value)
}

export function getWaTemplateEntry(key: WaTemplateKey): WaTemplateCatalogEntry {
  return WA_TEMPLATE_CATALOG[key]
}

export function allowedTokensForKey(key: WaTemplateKey): readonly string[] {
  const entry = getWaTemplateEntry(key)
  return [...entry.requiredTokens, ...entry.optionalTokens]
}

export function allTokensForKey(key: WaTemplateKey): readonly string[] {
  return allowedTokensForKey(key)
}
