import type { JSONContent } from '@tiptap/core'

export type StoredEmailTemplateBody = {
  v: 1
  blocks: EmailBlock[]
}

export type EmailBlock =
  | { type: 'branding_header'; id: string }
  | { type: 'paragraph'; id: string; doc: JSONContent }
  | { type: 'invoice_summary'; id: string }
  | { type: 'registration_receipt'; id: string }
  | { type: 'bank_details'; id: string }
  | { type: 'cta_button'; id: string; label: string }
  | { type: 'footer_disclaimer'; id: string; text: string }

export function newBlockId(): string {
  return globalThis.crypto.randomUUID()
}

export function isStoredEmailTemplateBody(value: unknown): value is StoredEmailTemplateBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as StoredEmailTemplateBody
  return v.v === 1 && Array.isArray(v.blocks)
}
