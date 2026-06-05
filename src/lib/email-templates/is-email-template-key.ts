import { EmailTemplateKey } from '@prisma/client'

const KEYS = new Set<string>(Object.values(EmailTemplateKey))

export function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return KEYS.has(value)
}
