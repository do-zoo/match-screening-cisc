import { Column, Link, Row, Section, Text } from 'react-email'
import type { ReactNode } from 'react'
import { createElement } from 'react'

import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'

export type EmailSummaryDataRow = {
  label: string
  value: string
  /** Jika diisi, nilai ditampilkan sebagai tautan (mis. alamat venue + map URL). */
  href?: string
  note?: string
  /** Teks bantu di bawah label (mis. pita total kekurangan bayar). */
  hint?: string
  sortOrder?: number
  holderName?: string
  menuName?: string | null
}

export type TransactionSummaryParts = {
  meta: EmailSummaryDataRow[]
  detail: EmailSummaryDataRow[]
  footer: EmailSummaryDataRow[]
}

export const ORDER_SUMMARY_CARD_TITLE = 'Ringkasan pesanan'
export const EVENT_SUMMARY_CARD_TITLE = 'Ringkasan acara'

const cardOuter = {
  backgroundColor: T.cardBg,
  border: `1px solid ${T.cardBorder}`,
  borderRadius: T.cardRadius,
}

const receiptSuccessOuter = {
  ...cardOuter,
  border: `1px solid ${T.surfaceSuccessBorder}`,
}

function isRegistrationIdRow(label: string): boolean {
  return label.toLowerCase().includes('nomor pemesanan') || label.toLowerCase().includes('id registrasi')
}

function isPrimaryTotalRow(label: string): boolean {
  const l = label.toLowerCase()
  return l.includes('total tagihan') || l.includes('total terverifikasi') || l.includes('kekurangan bayar')
}

function isSecondaryTotalRow(label: string): boolean {
  const l = label.toLowerCase()
  return l.includes('total registrasi') || l.includes('total pendaftaran') || l.includes('sudah dibayar')
}

function renderMetaRow(row: EmailSummaryDataRow, key: string, options?: { mutedValue?: boolean }): ReactNode {
  const idRow = isRegistrationIdRow(row.label)
  return createElement(
    Row,
    { key, style: { marginBottom: '10px' } },
    createElement(
      Column,
      { style: { width: '38%', verticalAlign: 'top' as const, paddingRight: '12px' } },
      createElement(
        Text,
        {
          style: {
            margin: 0,
            color: T.bodyTextMuted,
            fontSize: '13px',
            lineHeight: '1.45',
            fontWeight: 500,
          },
        },
        row.label,
      ),
    ),
    createElement(
      Column,
      { style: { width: '62%', verticalAlign: 'top' as const } },
      createElement(
        Text,
        {
          style: {
            margin: 0,
            color: options?.mutedValue ? T.bodyTextMuted : T.bodyText,
            fontSize: idRow ? '12px' : '14px',
            lineHeight: '1.5',
            fontWeight: idRow ? 500 : 600,
            fontFamily: idRow
              ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              : undefined,
            wordBreak: 'break-all' as const,
          },
        },
        row.href?.trim()
          ? createElement(
              Link,
              {
                href: row.href.trim(),
                style: {
                  color: T.accent,
                  textDecoration: 'underline',
                  fontWeight: 600,
                },
              },
              row.value,
            )
          : row.value,
      ),
    ),
  )
}

type NormalizedTicketLine = {
  sortOrder: number
  holderName: string
  menuName: string | null
  price: string
}

function normalizeTicketLines(detail: EmailSummaryDataRow[]): NormalizedTicketLine[] {
  return detail.map((row, index) => {
    if (row.sortOrder != null && row.holderName?.trim()) {
      const menu =
        row.menuName !== undefined
          ? row.menuName
          : row.note?.replace(/^Menu:\s*/i, '').trim() || null
      return {
        sortOrder: row.sortOrder,
        holderName: row.holderName.trim(),
        menuName: menu,
        price: row.value,
      }
    }

    const match = row.label.match(/^Tiket\s*#(\d+)\s*[·•]\s*(.+)$/i)
    const sortOrder = match ? Number(match[1]) : index + 1
    const holderName = match ? match[2].trim() : row.label.trim()
    const menuName = row.note?.replace(/^Menu:\s*/i, '').trim() || row.menuName || null

    return { sortOrder, holderName, menuName, price: row.value }
  })
}

function allHoldersEqual(lines: NormalizedTicketLine[]): boolean {
  if (lines.length <= 1) return true
  const first = lines[0]?.holderName
  return lines.every(line => line.holderName === first)
}

function anyMenu(lines: NormalizedTicketLine[]): boolean {
  return lines.some(line => line.menuName?.trim())
}

type DetailTableLayout = {
  sameHolder: boolean
  showHolderColumn: boolean
  showMenuColumn: boolean
  subtitle: string
}

function resolveDetailTableLayout(lines: NormalizedTicketLine[]): DetailTableLayout {
  const sameHolder = allHoldersEqual(lines)
  const showMenuColumn = anyMenu(lines)
  const showHolderColumn = !sameHolder
  const count = lines.length

  let subtitle: string
  if (sameHolder) {
    subtitle = `Pemegang tiket: ${lines[0]?.holderName ?? '—'} (${count} tiket)`
  } else if (showMenuColumn) {
    subtitle = `${count} tiket · pemegang dan menu per baris`
  } else {
    subtitle = `${count} tiket · pemegang berbeda per baris`
  }

  return { sameHolder, showHolderColumn, showMenuColumn, subtitle }
}

const detailTableFrameStyle = {
  width: '100%',
  maxWidth: '100%',
  border: `1px solid ${T.cardDetailBorder}`,
  borderRadius: '6px',
  overflow: 'hidden' as const,
  boxSizing: 'border-box' as const,
}

/** Kolom kanan kosong — persen saja agar lebar baris = 100% (px + % sering overflow di klien email). */
const DETAIL_TABLE_EDGE_GUTTER_PCT = '7%'

const detailTableRowLayout = {
  width: '100%',
  maxWidth: '100%',
  tableLayout: 'fixed' as const,
}

const detailTableHeadText = {
  color: T.bodyTextMuted,
  fontSize: '11px',
  fontWeight: 700 as const,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  lineHeight: '1.3',
  margin: 0,
}

const detailColHeadNo = {
  verticalAlign: 'middle' as const,
  paddingTop: '10px',
  paddingBottom: '10px',
  paddingLeft: '14px',
  paddingRight: '8px',
}

const detailColHeadMid = {
  verticalAlign: 'middle' as const,
  paddingTop: '10px',
  paddingBottom: '10px',
  paddingLeft: '8px',
  paddingRight: '10px',
}

const detailColHeadPrice = {
  verticalAlign: 'middle' as const,
  paddingTop: '10px',
  paddingBottom: '10px',
  paddingLeft: '8px',
  paddingRight: '10px',
}

const detailColBodyNo = {
  verticalAlign: 'top' as const,
  paddingTop: '12px',
  paddingBottom: '12px',
  paddingLeft: '14px',
  paddingRight: '8px',
}

const detailColBodyMid = {
  verticalAlign: 'top' as const,
  paddingTop: '12px',
  paddingBottom: '12px',
  paddingLeft: '8px',
  paddingRight: '10px',
}

const detailColBodyPrice = {
  verticalAlign: 'top' as const,
  paddingTop: '12px',
  paddingBottom: '12px',
  paddingLeft: '8px',
  paddingRight: '10px',
}

function renderDetailTableEdgeGutter(): ReactNode {
  return createElement(
    Column,
    {
      style: {
        width: DETAIL_TABLE_EDGE_GUTTER_PCT,
        padding: 0,
        lineHeight: '1px',
        fontSize: '1px',
      },
    },
    createElement(Text, { style: { margin: 0, fontSize: '1px', lineHeight: '1px' } }, '\u00a0'),
  )
}

function detailTableWidths(options: {
  showHolderColumn: boolean
  showMenuColumn: boolean
}): {
  noWidth: string
  holderWidth: string
  menuWidth: string
  priceWidth: string
} {
  const { showHolderColumn, showMenuColumn } = options
  if (showMenuColumn) {
    return { noWidth: '9%', holderWidth: '26%', menuWidth: '26%', priceWidth: '32%' }
  }
  if (showHolderColumn) {
    return { noWidth: '10%', holderWidth: '48%', menuWidth: '0%', priceWidth: '35%' }
  }
  return { noWidth: '12%', holderWidth: '0%', menuWidth: '0%', priceWidth: '81%' }
}

function renderDetailTableHeader(options: {
  showHolderColumn: boolean
  showMenuColumn: boolean
}): ReactNode {
  const { showHolderColumn, showMenuColumn } = options
  const { noWidth, holderWidth, menuWidth, priceWidth } = detailTableWidths({
    showHolderColumn,
    showMenuColumn,
  })
  return createElement(
    Row,
    {
      key: 'detail-head',
      style: {
        ...detailTableRowLayout,
        backgroundColor: '#eef2f7',
        borderBottom: `1px solid ${T.cardDetailBorder}`,
      },
    },
    createElement(
      Column,
      { style: { width: noWidth, ...detailColHeadNo } },
      createElement(Text, { style: detailTableHeadText }, 'No.'),
    ),
    showHolderColumn
      ? createElement(
          Column,
          { style: { width: holderWidth, ...detailColHeadMid } },
          createElement(Text, { style: detailTableHeadText }, 'Pemegang tiket'),
        )
      : null,
    showMenuColumn
      ? createElement(
          Column,
          { style: { width: menuWidth, ...detailColHeadMid } },
          createElement(Text, { style: detailTableHeadText }, 'Menu'),
        )
      : null,
    createElement(
      Column,
      { align: 'right', style: { width: priceWidth, ...detailColHeadPrice } },
      createElement(Text, { style: { ...detailTableHeadText, textAlign: 'right' as const } }, 'Harga'),
    ),
    renderDetailTableEdgeGutter(),
  )
}

function renderDetailTableRow(
  line: NormalizedTicketLine,
  index: number,
  options: { showHolderColumn: boolean; showMenuColumn: boolean; isLast: boolean },
): ReactNode {
  const { showHolderColumn, showMenuColumn, isLast } = options
  const { noWidth, holderWidth, menuWidth, priceWidth } = detailTableWidths({
    showHolderColumn,
    showMenuColumn,
  })
  const zebra = index % 2 === 1 ? { backgroundColor: '#f8fafc' } : undefined

  return createElement(
    Row,
    {
      key: `detail-row-${line.sortOrder}`,
      style: {
        ...detailTableRowLayout,
        ...zebra,
        borderBottom: isLast ? undefined : `1px solid ${T.cardDetailBorder}`,
      },
    },
    createElement(
      Column,
      { style: { width: noWidth, ...detailColBodyNo } },
      createElement(Text, { style: { margin: 0, fontSize: '13px', fontWeight: 600, color: T.bodyText } }, String(line.sortOrder)),
    ),
    showHolderColumn
      ? createElement(
          Column,
          { style: { width: holderWidth, ...detailColBodyMid } },
          createElement(
            Text,
            {
              style: {
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: T.bodyText,
                lineHeight: '1.45',
                wordBreak: 'break-word' as const,
              },
            },
            line.holderName,
          ),
        )
      : null,
    showMenuColumn
      ? createElement(
          Column,
          { style: { width: menuWidth, ...detailColBodyMid } },
          createElement(
            Text,
            {
              style: {
                margin: 0,
                fontSize: '12px',
                color: line.menuName ? T.bodyText : T.bodyTextMuted,
                lineHeight: '1.4',
              },
            },
            line.menuName?.trim() || '—',
          ),
        )
      : null,
    createElement(
      Column,
      { align: 'right', style: { width: priceWidth, ...detailColBodyPrice } },
      createElement(
        Text,
        {
          style: {
            margin: 0,
            fontSize: '13px',
            fontWeight: 700,
            color: T.bodyText,
            textAlign: 'right' as const,
            lineHeight: '1.45',
          },
        },
        line.price,
      ),
    ),
    renderDetailTableEdgeGutter(),
  )
}

function renderDetailPanel(detail: EmailSummaryDataRow[]): ReactNode | null {
  if (detail.length === 0) return null

  const lines = normalizeTicketLines(detail)
  const { showHolderColumn, showMenuColumn, subtitle } = resolveDetailTableLayout(lines)

  return createElement(
    Section,
    {
      style: {
        paddingTop: '16px',
        marginTop: '12px',
        borderTop: `1px solid ${T.cardBorder}`,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box' as const,
      },
    },
    createElement(
      Text,
      {
        style: {
          margin: '0 0 4px',
          color: T.bodyText,
          fontSize: '14px',
          fontWeight: 700,
          lineHeight: '1.3',
        },
      },
      'Rincian tiket',
    ),
    createElement(
      Text,
      {
        style: {
          margin: '0 0 12px',
          color: T.bodyTextMuted,
          fontSize: '13px',
          lineHeight: '1.45',
        },
      },
      subtitle,
    ),
    createElement(
      Section,
      { style: detailTableFrameStyle },
      renderDetailTableHeader({ showHolderColumn, showMenuColumn }),
      ...lines.map((line, index) =>
        renderDetailTableRow(line, index, {
          showHolderColumn,
          showMenuColumn,
          isLast: index === lines.length - 1,
        }),
      ),
    ),
  )
}

function renderTotalBand(row: EmailSummaryDataRow, variant: 'default' | 'success'): ReactNode {
  const bg = variant === 'success' ? '#d1fae5' : T.cardTotalBg
  const border = variant === 'success' ? T.surfaceSuccessBorder : T.cardTotalBorder
  const textColor = variant === 'success' ? T.surfaceSuccessText : T.cardTotalText

  return createElement(
    Section,
    {
      style: {
        padding: '16px 24px',
        backgroundColor: bg,
        borderTop: `2px solid ${border}`,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box' as const,
      },
    },
    createElement(
      Row,
      { style: detailTableRowLayout },
      createElement(
        Column,
        { style: { width: '46%', verticalAlign: 'middle' as const, paddingRight: '12px' } },
        createElement(
          Text,
          {
            style: {
              margin: 0,
              color: textColor,
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: '1.4',
            },
          },
          row.label,
        ),
        row.hint?.trim()
          ? createElement(
              Text,
              {
                style: {
                  margin: '4px 0 0',
                  color: textColor,
                  fontSize: '12px',
                  fontWeight: 400,
                  lineHeight: '1.4',
                  opacity: 0.85,
                },
              },
              row.hint.trim(),
            )
          : null,
      ),
      createElement(
        Column,
        {
          align: 'right',
          style: {
            verticalAlign: 'middle' as const,
            paddingTop: '0',
            paddingBottom: '0',
            paddingLeft: '8px',
            paddingRight: '10px',
          },
        },
        createElement(
          Text,
          {
            style: {
              margin: 0,
              color: textColor,
              fontSize: '20px',
              fontWeight: 700,
              lineHeight: '1.2',
              letterSpacing: '-0.02em',
              textAlign: 'right' as const,
            },
          },
          row.value,
        ),
      ),
      renderDetailTableEdgeGutter(),
    ),
  )
}

function renderFooterSection(footer: EmailSummaryDataRow[], variant: 'default' | 'success'): ReactNode[] {
  const nodes: ReactNode[] = []
  const primaryTotals: EmailSummaryDataRow[] = []
  const secondaryTotals: EmailSummaryDataRow[] = []
  const rest: EmailSummaryDataRow[] = []

  for (const row of footer) {
    if (isPrimaryTotalRow(row.label)) primaryTotals.push(row)
    else if (isSecondaryTotalRow(row.label)) secondaryTotals.push(row)
    else rest.push(row)
  }

  if (secondaryTotals.length > 0) {
    nodes.push(
      createElement(
        Section,
        { key: 'footer-secondary', style: { padding: '0 24px 12px' } },
        ...secondaryTotals.map((row, i) => renderMetaRow(row, `sec-total-${i}`, { mutedValue: true })),
      ),
    )
  }

  const mainTotal = primaryTotals[primaryTotals.length - 1]
  if (mainTotal) {
    nodes.push(createElement(Section, { key: 'footer-primary' }, renderTotalBand(mainTotal, variant)))
  }

  if (rest.length > 0) {
    nodes.push(
      createElement(
        Section,
        {
          key: 'footer-rest',
          style: {
            padding: '16px 24px 20px',
            borderTop: mainTotal ? `1px solid ${T.cardBorder}` : undefined,
          },
        },
        ...rest.map((row, i) => renderMetaRow(row, `footer-meta-${i}`)),
      ),
    )
  }

  return nodes
}

function renderSummaryCardTitle(title: string): ReactNode {
  return createElement(
    Text,
    {
      style: {
        margin: '0 0 16px',
        color: T.bodyText,
        fontSize: '14px',
        fontWeight: 700,
        lineHeight: '1.3',
      },
    },
    title,
  )
}

export function renderTransactionSummaryCard(
  parts: TransactionSummaryParts,
  variant: 'default' | 'success' = 'default',
  options?: { title?: string },
): ReactNode {
  const outerStyle = variant === 'success' ? receiptSuccessOuter : cardOuter
  const cardTitle = options?.title?.trim()

  return createElement(
    Section,
    { style: { ...outerStyle, width: '100%', maxWidth: '100%', boxSizing: 'border-box' as const } },
    createElement(
      Section,
      { style: { padding: '20px 24px 16px' } },
      cardTitle ? renderSummaryCardTitle(cardTitle) : null,
      ...parts.meta.map((row, i) => renderMetaRow(row, `meta-${i}`)),
      renderDetailPanel(parts.detail),
    ),
    ...renderFooterSection(parts.footer, variant),
  )
}

export function summaryPartsToPlainLines(parts: TransactionSummaryParts): string[] {
  const lines: string[] = []
  for (const row of parts.meta) {
    const href = row.href?.trim()
    lines.push(href ? `${row.label}: ${row.value} (${href})` : `${row.label}: ${row.value}`)
  }
  if (parts.detail.length > 0) {
    lines.push('Rincian tiket')
    for (const row of normalizeTicketLines(parts.detail)) {
      const menu = row.menuName ? ` · ${row.menuName}` : ''
      lines.push(`#${row.sortOrder} ${row.holderName}${menu}: ${row.price}`)
    }
  }
  for (const row of parts.footer) {
    lines.push(`${row.label}: ${row.value}`)
  }
  return lines
}
