import { Button, Section, Text } from 'react-email'
import { EmailTemplateKey } from '@prisma/client'
import type { ReactNode } from 'react'
import { createElement } from 'react'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { emailDocToPlainText } from '@/lib/email-templates/email-doc-serializer'
import { emailDocToReactNodes } from '@/lib/email-templates/email-doc-react'
import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'
import {
  formatContactPlainLines,
  type ClubEmailContactProps,
} from '@/lib/email-templates/emails/club-email-plain-contact'
import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'

const BODY_X = '32px'

function invoiceSummaryLine(templateKey: EmailTemplateKey): string {
  if (templateKey === EmailTemplateKey.invoice) {
    return 'Total tagihan untuk {event_title}: {total_amount_idr}'
  }
  return 'Kekurangan bayar untuk {event_title}: {adjustment_amount_idr}'
}

function registrationReceiptLines(vars: Record<string, string>): string[] {
  const lines = [
    `Nomor pemesanan: ${applyEmailPlaceholders('{registration_id}', vars)}`,
    `Acara: ${applyEmailPlaceholders('{event_title}', vars)}`,
    `Total terverifikasi: ${applyEmailPlaceholders('{computed_total_idr}', vars)}`,
  ]
  if (vars.ticket_category_name?.trim()) {
    lines.push(`Kategori tiket: ${vars.ticket_category_name}`)
  }
  if (vars.ticket_qty?.trim()) {
    lines.push(`Jumlah tiket: ${vars.ticket_qty}`)
  }
  if (vars.venue?.trim()) {
    lines.push(`Venue: ${vars.venue}`)
  }
  if (vars.start_at_formatted?.trim()) {
    lines.push(`Waktu acara: ${vars.start_at_formatted}`)
  }
  if (vars.open_gate_at_formatted?.trim()) {
    lines.push(`Buka gate: ${vars.open_gate_at_formatted}`)
  }
  return lines
}

export function renderEmailBlocks(props: {
  templateKey: EmailTemplateKey
  blocks: EmailBlock[]
  vars: Record<string, string>
}): ReactNode[] {
  const { templateKey, blocks, vars } = props
  const nodes: ReactNode[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'branding_header':
        break
      case 'paragraph':
        nodes.push(
          createElement(
            Section,
            { key: block.id, style: { padding: `16px ${BODY_X} 0` } },
            ...emailDocToReactNodes(block.doc, vars),
          ),
        )
        break
      case 'invoice_summary':
        nodes.push(
          createElement(
            Section,
            {
              key: block.id,
              style: { padding: `8px ${BODY_X} 0` },
            },
            createElement(
              Section,
              {
                style: {
                  backgroundColor: T.surfaceMuted,
                  border: `1px solid ${T.surfaceMutedBorder}`,
                  borderRadius: '8px',
                  padding: '16px 18px',
                },
              },
              createElement(
                Text,
                {
                  style: {
                    color: T.textMuted,
                    fontSize: '14px',
                    lineHeight: '1.6',
                    margin: 0,
                    fontWeight: 500,
                  },
                },
                applyEmailPlaceholders(invoiceSummaryLine(templateKey), vars),
              ),
            ),
          ),
        )
        break
      case 'registration_receipt':
        nodes.push(
          createElement(
            Section,
            {
              key: block.id,
              style: { padding: `8px ${BODY_X} 0` },
            },
            createElement(
              Section,
              {
                style: {
                  backgroundColor: T.surfaceSuccessBg,
                  border: `1px solid ${T.surfaceSuccessBorder}`,
                  borderRadius: '8px',
                  padding: '16px 18px',
                },
              },
              createElement(
                Text,
                {
                  style: {
                    color: T.surfaceSuccessText,
                    fontSize: '14px',
                    lineHeight: '1.75',
                    margin: 0,
                    whiteSpace: 'pre-wrap' as const,
                    fontWeight: 500,
                  },
                },
                registrationReceiptLines(vars).join('\n'),
              ),
            ),
          ),
        )
        break
      case 'bank_details': {
        const bankText = [
          'Transfer ke:',
          `Bank: ${applyEmailPlaceholders('{bank_name}', vars)}`,
          `No. Rekening: ${applyEmailPlaceholders('{account_number}', vars)}`,
          `Atas nama: ${applyEmailPlaceholders('{account_name}', vars)}`,
        ].join('\n')
        nodes.push(
          createElement(
            Section,
            {
              key: block.id,
              style: { padding: `16px ${BODY_X} 0` },
            },
            createElement(
              Section,
              {
                style: {
                  borderLeft: `3px solid ${T.primary}`,
                  paddingLeft: '16px',
                },
              },
              createElement(
                Text,
                {
                  style: {
                    color: T.textMuted,
                    fontSize: '14px',
                    lineHeight: '1.75',
                    margin: 0,
                    whiteSpace: 'pre-wrap' as const,
                  },
                },
                bankText,
              ),
            ),
          ),
        )
        break
      }
      case 'cta_button':
        nodes.push(
          createElement(
            Section,
            { key: block.id, style: { padding: `20px ${BODY_X} 8px`, textAlign: 'center' } },
            createElement(
              Button,
              {
                href: vars.magic_link_url ?? '#',
                style: {
                  backgroundColor: T.primary,
                  color: T.primaryForeground,
                  padding: '14px 28px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 600,
                  display: 'inline-block',
                },
              },
              block.label.trim() || 'Masuk sekarang',
            ),
          ),
        )
        break
      case 'footer_disclaimer':
        nodes.push(
          createElement(
            Section,
            {
              key: block.id,
              style: {
                padding: '20px 32px 28px',
                borderTop: `1px solid ${T.cardBorder}`,
              },
            },
            createElement(
              Text,
              {
                style: {
                  color: T.textMuted,
                  fontSize: '12px',
                  lineHeight: '1.6',
                  margin: 0,
                  textAlign: 'center' as const,
                },
              },
              applyEmailPlaceholders(block.text, vars),
            ),
          ),
        )
        break
      default:
        break
    }
  }

  return nodes
}

export function blocksToPlainText(props: {
  templateKey: EmailTemplateKey
  blocks: EmailBlock[]
  vars: Record<string, string>
  contact: ClubEmailContactProps
}): string {
  const lines: string[] = []
  const { templateKey, blocks, vars, contact } = props

  for (const block of blocks) {
    switch (block.type) {
      case 'branding_header':
        break
      case 'paragraph':
        lines.push(emailDocToPlainText(block.doc, vars), '')
        break
      case 'invoice_summary':
        lines.push(applyEmailPlaceholders(invoiceSummaryLine(templateKey), vars), '')
        break
      case 'registration_receipt':
        lines.push(...registrationReceiptLines(vars), '')
        break
      case 'bank_details':
        lines.push(
          'Transfer ke:',
          `Bank: ${applyEmailPlaceholders('{bank_name}', vars)}`,
          `No. Rekening: ${applyEmailPlaceholders('{account_number}', vars)}`,
          `Atas nama: ${applyEmailPlaceholders('{account_name}', vars)}`,
          '',
        )
        break
      case 'cta_button':
        lines.push(`${block.label}: ${vars.magic_link_url ?? ''}`, '')
        break
      case 'footer_disclaimer':
        break
      default:
        break
    }
  }

  const contactLines = formatContactPlainLines(contact)
  if (contactLines.length > 0) {
    lines.push('---', ...contactLines, '')
  }

  for (const block of blocks) {
    if (block.type === 'footer_disclaimer') {
      lines.push(applyEmailPlaceholders(block.text, vars), '')
    }
  }

  return lines.join('\n').trim()
}
