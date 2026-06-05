import { EmailTemplateKey } from '@prisma/client'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { newBlockId } from '@/lib/email-templates/email-block-types'
import { emptyEmailDoc } from '@/lib/email-templates/email-doc-serializer'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'

type AddableBlockType = Exclude<EmailBlock['type'], 'branding_header'>

export const EMAIL_BLOCK_LABELS: Record<AddableBlockType, string> = {
  paragraph: 'Paragraf',
  hr: 'Garis pemisah',
  invoice_summary: 'Ringkasan tagihan',
  registration_receipt: 'Ringkasan pesanan',
  event_schedule: 'Ringkasan acara',
  bank_details: 'Detail rekening',
  cta_button: 'Tombol',
  footer_disclaimer: 'Footer',
}

export const EMAIL_BLOCK_HINTS: Record<AddableBlockType, string> = {
  paragraph: 'Teks bebas dengan format bold, link, list, dan kutipan.',
  hr: 'Garis horizontal untuk memisahkan bagian konten.',
  invoice_summary: 'Ringkasan nominal diisi otomatis saat email dikirim.',
  registration_receipt: 'Nomor pemesanan, tiket, dan total terverifikasi — kartu ringkasan pesanan.',
  event_schedule: 'Nama acara, venue, lokasi (tautan bila ada URL peta), dan waktu — kartu ringkasan acara.',
  bank_details: 'Detail rekening diisi otomatis dari data acara.',
  cta_button: 'Tombol tautan; atur label dan URL (placeholder seperti {event_page_url} atau URL lengkap).',
  footer_disclaimer: 'Teks disclaimer di bagian bawah email.',
}

const ADDABLE_BLOCK_ORDER: AddableBlockType[] = [
  'paragraph',
  'hr',
  'event_schedule',
  'registration_receipt',
  'invoice_summary',
  'bank_details',
  'cta_button',
  'footer_disclaimer',
]

const SINGLETON_BLOCK_TYPES = new Set<AddableBlockType>([
  'invoice_summary',
  'registration_receipt',
  'event_schedule',
  'bank_details',
  'cta_button',
  'footer_disclaimer',
])

const CTA_BUTTON_EXCLUDED_TEMPLATES = new Set<EmailTemplateKey>([EmailTemplateKey.otp])

function defaultCtaHrefForTemplate(key: EmailTemplateKey): string {
  if (key === EmailTemplateKey.magic_link) return '{magic_link_url}'
  if (key === EmailTemplateKey.admin_invite) return '{invite_url}'
  return '{event_page_url}'
}

export function addableBlockTypesForTemplate(key: EmailTemplateKey): AddableBlockType[] {
  const entry = getEmailTemplateEntry(key)
  const allowed = new Set(entry.defaultBlocks.map(b => b.type as AddableBlockType))
  allowed.add('paragraph')
  allowed.add('hr')
  if (!CTA_BUTTON_EXCLUDED_TEMPLATES.has(key)) allowed.add('cta_button')
  return ADDABLE_BLOCK_ORDER.filter(t => allowed.has(t))
}

export function createEmailBlock(type: AddableBlockType, key: EmailTemplateKey): EmailBlock {
  const entry = getEmailTemplateEntry(key)
  const seed = entry.defaultBlocks.find(b => b.type === type)

  if (type === 'paragraph') {
    return { type: 'paragraph', id: newBlockId(), doc: emptyEmailDoc() }
  }
  if (type === 'cta_button') {
    const label = seed?.type === 'cta_button' ? seed.label : 'Buka tautan'
    const href =
      seed?.type === 'cta_button' && seed.href?.trim()
        ? seed.href
        : defaultCtaHrefForTemplate(key)
    return { type: 'cta_button', id: newBlockId(), label, href }
  }
  if (type === 'footer_disclaimer') {
    const text = seed?.type === 'footer_disclaimer' ? seed.text : ''
    return { type: 'footer_disclaimer', id: newBlockId(), text }
  }
  return { type, id: newBlockId() }
}

function insertIndexForBlock(blocks: EmailBlock[], type: AddableBlockType): number {
  const findFirst = (...types: EmailBlock['type'][]) => {
    for (const t of types) {
      const i = blocks.findIndex(b => b.type === t)
      if (i >= 0) return i
    }
    return -1
  }

  switch (type) {
    case 'event_schedule': {
      const i = findFirst('registration_receipt', 'footer_disclaimer', 'cta_button')
      return i >= 0 ? i : blocks.length
    }
    case 'registration_receipt': {
      const i = findFirst('footer_disclaimer', 'cta_button')
      return i >= 0 ? i : blocks.length
    }
    case 'invoice_summary': {
      const i = findFirst('bank_details', 'footer_disclaimer', 'cta_button')
      return i >= 0 ? i : blocks.length
    }
    case 'bank_details': {
      const i = findFirst('footer_disclaimer', 'cta_button')
      return i >= 0 ? i : blocks.length
    }
    case 'cta_button': {
      const i = findFirst('footer_disclaimer')
      return i >= 0 ? i : blocks.length
    }
    case 'footer_disclaimer':
      return blocks.length
    case 'paragraph':
    case 'hr': {
      const i = findFirst('cta_button', 'footer_disclaimer')
      return i >= 0 ? i : blocks.length
    }
    default:
      return blocks.length
  }
}

export function addEmailBlock(
  blocks: EmailBlock[],
  key: EmailTemplateKey,
  type: AddableBlockType,
): EmailBlock[] {
  if (!addableBlockTypesForTemplate(key).includes(type)) return blocks
  if (SINGLETON_BLOCK_TYPES.has(type) && blocks.some(b => b.type === type)) return blocks

  const block = createEmailBlock(type, key)
  const index = insertIndexForBlock(blocks, type)
  return [...blocks.slice(0, index), block, ...blocks.slice(index)]
}

export type EmailBlockAddOption = {
  type: AddableBlockType
  label: string
  hint: string
  alreadyAdded: boolean
}

export function listEmailBlockAddOptions(key: EmailTemplateKey, blocks: EmailBlock[]): EmailBlockAddOption[] {
  return addableBlockTypesForTemplate(key).map(type => ({
    type,
    label: EMAIL_BLOCK_LABELS[type],
    hint: EMAIL_BLOCK_HINTS[type],
    alreadyAdded:
      type !== 'paragraph' && SINGLETON_BLOCK_TYPES.has(type) && blocks.some(b => b.type === type),
  }))
}
