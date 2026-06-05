import { Button, Column, Row, Section, Text } from 'react-email'
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
import {
  parseTransactionLineItems,
  TRANSACTION_LINE_ITEMS_JSON_KEY,
} from '@/lib/email-templates/email-transaction-line-items'
import type { EmailSummaryDataRow, TransactionSummaryParts } from '@/lib/email-templates/emails/club-email-summary-card'
import {
  renderTransactionSummaryCard,
  summaryPartsToPlainLines,
} from '@/lib/email-templates/emails/club-email-summary-card'

const blockSpacing = { margin: '0 0 24px' }

function lineItemsFromVars(vars: Record<string, string>): EmailSummaryDataRow[] {
  return parseTransactionLineItems(vars[TRANSACTION_LINE_ITEMS_JSON_KEY]).map(item => ({
    label: item.label,
    value: item.value,
    note: item.note,
    sortOrder: item.sortOrder,
    holderName: item.holderName,
    menuName: item.menuName,
  }))
}

function buildInvoiceSummaryParts(
  templateKey: EmailTemplateKey,
  vars: Record<string, string>,
): TransactionSummaryParts {
  const meta: EmailSummaryDataRow[] = [
    { label: 'Acara', value: applyEmailPlaceholders('{event_title}', vars) },
  ]
  if (vars.registration_id?.trim()) {
    meta.push({ label: 'Nomor pemesanan', value: vars.registration_id.trim() })
  }
  if (vars.ticket_category_name?.trim()) {
    meta.push({ label: 'Kategori tiket', value: vars.ticket_category_name.trim() })
  }
  if (vars.ticket_qty?.trim()) {
    meta.push({ label: 'Jumlah tiket', value: vars.ticket_qty.trim() })
  }

  const footer: EmailSummaryDataRow[] = []
  if (templateKey === EmailTemplateKey.invoice_underpayment && vars.registration_total_idr?.trim()) {
    footer.push({
      label: 'Total pendaftaran',
      value: vars.registration_total_idr.trim(),
    })
    if (vars.amount_paid_idr?.trim()) {
      footer.push({
        label: 'Sudah dibayar',
        value: vars.amount_paid_idr.trim(),
      })
    }
    footer.push({
      label: 'Kekurangan bayar',
      value: applyEmailPlaceholders('{adjustment_amount_idr}', vars),
      hint: 'Nominal tambahan yang perlu ditransfer',
    })
  } else if (templateKey === EmailTemplateKey.invoice) {
    footer.push({
      label: 'Total tagihan',
      value: applyEmailPlaceholders('{total_amount_idr}', vars),
    })
  } else {
    footer.push({
      label: 'Kekurangan bayar',
      value: applyEmailPlaceholders('{adjustment_amount_idr}', vars),
    })
  }

  return { meta, detail: lineItemsFromVars(vars), footer }
}

function buildRegistrationReceiptParts(vars: Record<string, string>): TransactionSummaryParts {
  const meta: EmailSummaryDataRow[] = [
    {
      label: 'Nomor pemesanan',
      value: applyEmailPlaceholders('{registration_id}', vars),
    },
    { label: 'Acara', value: applyEmailPlaceholders('{event_title}', vars) },
  ]
  if (vars.ticket_category_name?.trim()) {
    meta.push({ label: 'Kategori tiket', value: vars.ticket_category_name.trim() })
  }
  if (vars.ticket_qty?.trim()) {
    meta.push({ label: 'Jumlah tiket', value: vars.ticket_qty.trim() })
  }

  const footer: EmailSummaryDataRow[] = [
    {
      label: 'Total terverifikasi',
      value: applyEmailPlaceholders('{computed_total_idr}', vars),
    },
  ]
  if (vars.venue?.trim()) {
    footer.push({ label: 'Venue', value: vars.venue.trim() })
  }
  if (vars.start_at_formatted?.trim()) {
    footer.push({ label: 'Waktu acara', value: vars.start_at_formatted.trim() })
  }
  if (vars.open_gate_at_formatted?.trim()) {
    footer.push({ label: 'Buka gate', value: vars.open_gate_at_formatted.trim() })
  }

  return { meta, detail: lineItemsFromVars(vars), footer }
}

function renderBankDetailsCard(vars: Record<string, string>): ReactNode {
  const rows: EmailSummaryDataRow[] = [
    { label: 'Bank', value: applyEmailPlaceholders('{bank_name}', vars) },
    { label: 'No. rekening', value: applyEmailPlaceholders('{account_number}', vars) },
    { label: 'Atas nama', value: applyEmailPlaceholders('{account_name}', vars) },
  ]

  return createElement(
    Section,
    {
      style: {
        backgroundColor: T.cardDetailBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: T.cardRadius,
        borderLeft: `4px solid ${T.accent}`,
        padding: '18px 20px',
      },
    },
    createElement(
      Text,
      {
        style: {
          margin: '0 0 14px',
          color: T.cardTotalText,
          fontSize: '14px',
          fontWeight: 700,
          lineHeight: '1.3',
        },
      },
      'Instruksi transfer',
    ),
    ...rows.map((row, index) =>
      createElement(
        Row,
        { key: `bank-${index}`, style: { marginBottom: index < rows.length - 1 ? '10px' : 0 } },
        createElement(
          Column,
          { style: { width: '36%', verticalAlign: 'top' as const, paddingRight: '10px' } },
          createElement(
            Text,
            {
              style: {
                margin: 0,
                color: T.bodyTextMuted,
                fontSize: '13px',
                lineHeight: '1.4',
              },
            },
            row.label,
          ),
        ),
        createElement(
          Column,
          { style: { width: '64%', verticalAlign: 'top' as const } },
          createElement(
            Text,
            {
              style: {
                margin: 0,
                color: T.bodyText,
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: '1.45',
                fontFamily:
                  row.label === 'No. rekening'
                    ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                    : undefined,
              },
            },
            row.value,
          ),
        ),
      ),
    ),
  )
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
            { key: block.id, style: blockSpacing },
            ...emailDocToReactNodes(block.doc, vars),
          ),
        )
        break
      case 'invoice_summary':
        nodes.push(
          createElement(
            Section,
            { key: block.id, style: blockSpacing },
            renderTransactionSummaryCard(buildInvoiceSummaryParts(templateKey, vars), 'default'),
          ),
        )
        break
      case 'registration_receipt':
        nodes.push(
          createElement(
            Section,
            { key: block.id, style: blockSpacing },
            renderTransactionSummaryCard(buildRegistrationReceiptParts(vars), 'success'),
          ),
        )
        break
      case 'bank_details':
        nodes.push(
          createElement(
            Section,
            { key: block.id, style: blockSpacing },
            renderBankDetailsCard(vars),
          ),
        )
        break
      case 'cta_button':
        nodes.push(
          createElement(
            Section,
            { key: block.id, style: { ...blockSpacing, textAlign: 'center' as const } },
            createElement(
              Button,
              {
                href: vars.invite_url ?? vars.magic_link_url ?? '#',
                style: {
                  backgroundColor: T.primary,
                  color: T.primaryForeground,
                  padding: '12px 24px',
                  borderRadius: T.ctaRadius,
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
                ...blockSpacing,
                paddingTop: '8px',
                borderTop: `1px solid ${T.disclaimerBorder}`,
              },
            },
            createElement(
              Text,
              {
                style: {
                  color: T.disclaimerText,
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
        lines.push(...summaryPartsToPlainLines(buildInvoiceSummaryParts(templateKey, vars)), '')
        break
      case 'registration_receipt':
        lines.push(...summaryPartsToPlainLines(buildRegistrationReceiptParts(vars)), '')
        break
      case 'bank_details':
        lines.push(
          'Instruksi transfer',
          `Bank: ${applyEmailPlaceholders('{bank_name}', vars)}`,
          `No. rekening: ${applyEmailPlaceholders('{account_number}', vars)}`,
          `Atas nama: ${applyEmailPlaceholders('{account_name}', vars)}`,
          '',
        )
        break
      case 'cta_button':
        lines.push(`${block.label}: ${vars.invite_url ?? vars.magic_link_url ?? ''}`, '')
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
