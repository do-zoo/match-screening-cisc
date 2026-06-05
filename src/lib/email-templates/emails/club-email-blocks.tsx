import { Button, Img, Section, Text } from 'react-email'
import { EmailTemplateKey } from '@prisma/client'
import type { ReactNode } from 'react'
import { createElement } from 'react'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { emailDocToPlainText } from '@/lib/email-templates/email-doc-serializer'
import { emailDocToReactNodes } from '@/lib/email-templates/email-doc-react'
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
  clubNameNav: string
  logoBlobUrl?: string | null
}): ReactNode[] {
  const { templateKey, blocks, vars, clubNameNav, logoBlobUrl } = props
  const nodes: ReactNode[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'branding_header':
        nodes.push(
          createElement(
            Section,
            {
              key: block.id,
              style: {
                padding: '28px 32px 20px',
                borderBottom: '1px solid #e4e4e7',
                backgroundColor: '#fafafa',
              },
            },
            logoBlobUrl
              ? createElement(Img, {
                  src: logoBlobUrl,
                  alt: vars.club_name_nav ?? clubNameNav,
                  height: 36,
                  style: { display: 'block', margin: '0 0 12px', maxHeight: '36px', width: 'auto' },
                })
              : null,
            createElement(
              Text,
              {
                style: {
                  fontSize: '18px',
                  fontWeight: 600,
                  margin: 0,
                  color: '#18181b',
                  letterSpacing: '-0.01em',
                  lineHeight: '1.3',
                },
              },
              vars.club_name_nav ?? clubNameNav,
            ),
          ),
        )
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
                  backgroundColor: '#f4f4f5',
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  padding: '16px 18px',
                },
              },
              createElement(
                Text,
                {
                  style: {
                    color: '#3f3f46',
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
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '16px 18px',
                },
              },
              createElement(
                Text,
                {
                  style: {
                    color: '#14532d',
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
                  borderLeft: '3px solid #18181b',
                  paddingLeft: '16px',
                },
              },
              createElement(
                Text,
                {
                  style: {
                    color: '#3f3f46',
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
                  backgroundColor: '#18181b',
                  color: '#ffffff',
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
                padding: '24px 32px 28px',
                marginTop: '8px',
                borderTop: '1px solid #e4e4e7',
                backgroundColor: '#fafafa',
              },
            },
            createElement(
              Text,
              {
                style: {
                  color: '#71717a',
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
  clubNameNav: string
}): string {
  const lines: string[] = []
  const { templateKey, blocks, vars, clubNameNav } = props

  for (const block of blocks) {
    switch (block.type) {
      case 'branding_header':
        lines.push(vars.club_name_nav ?? clubNameNav, '')
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
        lines.push(applyEmailPlaceholders(block.text, vars), '')
        break
      default:
        break
    }
  }

  return lines.join('\n').trim()
}
