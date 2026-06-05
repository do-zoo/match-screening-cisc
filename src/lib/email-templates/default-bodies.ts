import { EmailTemplateKey } from '@prisma/client'

import { EMAIL_TEMPLATE_CATALOG } from '@/lib/email-templates/email-template-catalog'
import { serializeStoredBody } from '@/lib/email-templates/parse-stored-email-body'

export type EmailTemplateDefaults = { subject: string; body: string }

export const CLUB_EMAIL_DEFAULT_BODIES: Record<EmailTemplateKey, EmailTemplateDefaults> = {
  [EmailTemplateKey.invoice]: {
    subject: EMAIL_TEMPLATE_CATALOG.invoice.defaultSubject,
    body: serializeStoredBody({
      v: 1,
      blocks: EMAIL_TEMPLATE_CATALOG.invoice.defaultBlocks,
    }),
  },
  [EmailTemplateKey.invoice_underpayment]: {
    subject: EMAIL_TEMPLATE_CATALOG.invoice_underpayment.defaultSubject,
    body: serializeStoredBody({
      v: 1,
      blocks: EMAIL_TEMPLATE_CATALOG.invoice_underpayment.defaultBlocks,
    }),
  },
  [EmailTemplateKey.registration_approved]: {
    subject: EMAIL_TEMPLATE_CATALOG.registration_approved.defaultSubject,
    body: serializeStoredBody({
      v: 1,
      blocks: EMAIL_TEMPLATE_CATALOG.registration_approved.defaultBlocks,
    }),
  },
  [EmailTemplateKey.magic_link]: {
    subject: EMAIL_TEMPLATE_CATALOG.magic_link.defaultSubject,
    body: serializeStoredBody({
      v: 1,
      blocks: EMAIL_TEMPLATE_CATALOG.magic_link.defaultBlocks,
    }),
  },
}
