import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'
import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'
import type {
  InvoicePdfKind,
  InvoicePdfPaymentStatus,
  RegistrationInvoicePdfVm,
} from './registration-invoice-pdf-types'

const pdfDateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeStyle: 'short',
})

/** Ruang vertikal header/footer fixed — selaras padding `page`. */
const PDF_HEADER_ZONE_PT = 72
const PDF_FOOTER_ZONE_PT = 92

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: T.pageBg,
    color: T.shellText,
    paddingTop: PDF_HEADER_ZONE_PT,
    paddingBottom: PDF_FOOTER_ZONE_PT,
  },
  headerBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: T.headerGradientStart,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.headerBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoWrap: {
    width: 72,
    flexShrink: 0,
  },
  logo: {
    height: 32,
    maxWidth: 72,
    objectFit: 'contain',
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  clubName: {
    fontSize: 8,
    color: T.headerSubtext,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: T.headerText,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 9,
    color: T.headerSubtext,
    marginTop: 2,
  },
  headerBadgeWrap: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    letterSpacing: 0.2,
  },
  statusPaid: {
    backgroundColor: T.surfaceSuccessBg,
    color: T.surfaceSuccessText,
    borderWidth: 1,
    borderColor: T.surfaceSuccessBorder,
  },
  statusUnpaid: {
    backgroundColor: '#fffbeb',
    color: '#92400e',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 16,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: T.accent,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  infoCol: {
    width: '50%',
    paddingRight: 12,
    marginBottom: 10,
  },
  infoColFull: {
    width: '100%',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 8,
    color: T.bodyTextMuted,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 10,
    color: T.bodyText,
    lineHeight: 1.4,
  },
  infoValueMono: {
    fontSize: 9,
    color: T.bodyText,
    fontFamily: 'Courier',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: T.cardDetailBg,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: T.cardDetailBorder,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: T.cardDetailBorder,
    backgroundColor: T.shellBg,
  },
  tableRowAlt: {
    backgroundColor: T.cardDetailBg,
  },
  colItem: { flex: 1 },
  colPrice: { width: 100, textAlign: 'right' },
  colHeaderText: {
    fontWeight: 'bold',
    fontSize: 8,
    color: T.bodyTextMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lineLabel: { fontSize: 10, color: T.bodyText },
  lineNote: { fontSize: 8, color: T.bodyTextMuted, marginTop: 2 },
  linePrice: { fontSize: 10, color: T.bodyText, fontWeight: 'bold' },
  totalCard: {
    backgroundColor: T.cardTotalBg,
    borderWidth: 1,
    borderColor: T.cardTotalBorder,
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalRowLabel: { fontSize: 10, color: T.bodyTextMuted },
  totalRowValue: { fontSize: 10, color: T.bodyText, fontWeight: 'bold' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: T.cardTotalBorder,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: T.cardTotalText,
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: T.cardTotalText,
  },
  bankCard: {
    backgroundColor: T.shellBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderLeftWidth: 4,
    borderLeftColor: T.accent,
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
  },
  bankTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: T.accent,
    marginBottom: 10,
  },
  bankRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bankLabel: { width: 90, fontSize: 9, color: T.bodyTextMuted },
  bankValue: { flex: 1, fontSize: 10, color: T.bodyText, fontWeight: 'bold' },
  bankHint: {
    fontSize: 8,
    color: T.bodyTextMuted,
    marginTop: 8,
    lineHeight: 1.45,
  },
  footerBand: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.footerBg,
    paddingHorizontal: 40,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: T.footerBorder,
  },
  footerPageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6,
    gap: 12,
  },
  footerDisclaimer: {
    flex: 1,
    fontSize: 8,
    color: T.footerMuted,
    lineHeight: 1.4,
  },
  footerPageNumber: {
    fontSize: 8,
    color: T.footerMuted,
  },
  footerText: {
    fontSize: 9,
    color: T.footerText,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  footerLabel: {
    fontSize: 8,
    color: T.footerLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footerMuted: {
    fontSize: 8,
    color: T.footerMuted,
    marginTop: 8,
    lineHeight: 1.4,
  },
  paidBanner: {
    backgroundColor: T.surfaceSuccessBg,
    borderWidth: 1,
    borderColor: T.surfaceSuccessBorder,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidBannerText: {
    fontSize: 10,
    color: T.surfaceSuccessText,
    fontWeight: 'bold',
  },
})

function invoiceTitle(kind: InvoicePdfKind): string {
  return kind === 'adjustment' ? 'Tagihan Penyesuaian' : 'Tagihan Pendaftaran'
}

function paymentStatusLabel(status: InvoicePdfPaymentStatus): string {
  if (status === 'paid') return 'Lunas'
  if (status === 'unpaid_adjustment') return 'Belum lunas'
  return 'Menunggu pembayaran'
}

function statusBadgeStyle(status: InvoicePdfPaymentStatus) {
  const base = styles.statusBadge
  if (status === 'paid') return [base, styles.statusPaid]
  return [base, styles.statusUnpaid]
}

function formatPdfDate(date: Date): string {
  return pdfDateFormatter.format(date)
}

function amountDueIdr(vm: RegistrationInvoicePdfVm): number {
  if (vm.kind === 'adjustment' && vm.adjustmentAmountIdr != null) return vm.adjustmentAmountIdr
  return vm.registrationTotalIdr
}

function InfoField(props: { label: string; value: string; mono?: boolean; fullWidth?: boolean }) {
  return (
    <View style={props.fullWidth ? styles.infoColFull : styles.infoCol}>
      <Text style={styles.infoLabel}>{props.label}</Text>
      <Text style={props.mono ? styles.infoValueMono : styles.infoValue}>{props.value}</Text>
    </View>
  )
}

function InvoicePdfHeader({
  vm,
  logoSrc,
  statusLabel,
}: {
  vm: RegistrationInvoicePdfVm
  logoSrc?: string | null
  statusLabel: string
}) {
  return (
    <View style={styles.headerBand} fixed>
      <View style={styles.headerRow}>
        {logoSrc ? (
          <View style={styles.logoWrap}>
            <Image src={logoSrc} style={styles.logo} />
          </View>
        ) : null}
        <View style={styles.headerMain}>
          <Text style={styles.clubName}>{vm.clubNameNav}</Text>
          <Text style={styles.title}>{invoiceTitle(vm.kind)}</Text>
          <Text style={styles.headerSubtitle}>
            {vm.eventTitle} · {vm.ticketQty} tiket · {vm.ticketCategoryName}
          </Text>
        </View>
        <View style={styles.headerBadgeWrap}>
          <Text style={statusBadgeStyle(vm.paymentStatus)}>{statusLabel}</Text>
        </View>
      </View>
    </View>
  )
}

function InvoicePdfFooter({ vm }: { vm: RegistrationInvoicePdfVm }) {
  return (
    <View style={styles.footerBand} fixed>
      {vm.committeeContactEmail ? (
        <>
          <Text style={styles.footerLabel}>Kontak komite</Text>
          <Text style={styles.footerText}>{vm.committeeContactEmail}</Text>
        </>
      ) : null}
      <View style={styles.footerPageRow}>
        <Text style={styles.footerDisclaimer}>
          Dokumen ini diterbitkan oleh {vm.clubNameNav} untuk keperluan arsip dan pembayaran registrasi acara.
        </Text>
        <Text
          style={styles.footerPageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Halaman ${pageNumber} dari ${totalPages}` : ''
          }
        />
      </View>
    </View>
  )
}

export function RegistrationInvoicePdfDocument({
  vm,
  logoSrc,
}: {
  vm: RegistrationInvoicePdfVm
  logoSrc?: string | null
}) {
  const statusLabel = paymentStatusLabel(vm.paymentStatus)
  const dueAmount = amountDueIdr(vm)
  const isPaid = vm.paymentStatus === 'paid'

  return (
    <Document>
      <Page size='A4' style={styles.page}>
        <InvoicePdfHeader vm={vm} logoSrc={logoSrc} statusLabel={statusLabel} />

        <View style={styles.body}>
          {isPaid && vm.paidAt ? (
            <View style={styles.paidBanner}>
              <Text style={styles.paidBannerText}>Pembayaran tercatat lunas pada {formatPdfDate(vm.paidAt)}</Text>
            </View>
          ) : null}

          {isPaid && !vm.paidAt && vm.kind === 'registration' ? (
            <View style={styles.paidBanner}>
              <Text style={styles.paidBannerText}>Pendaftaran telah disetujui — pembayaran tercatat lunas</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informasi tagihan</Text>
            <View style={styles.infoGrid}>
              <InfoField label='Nama kontak' value={vm.contactName} />
              <InfoField label='Tanggal terbit' value={formatPdfDate(vm.issuedAt)} />
              <InfoField label='ID pendaftaran' value={vm.registrationId} mono />
              {vm.adjustmentId ? (
                <InfoField label='ID penyesuaian' value={vm.adjustmentId} mono />
              ) : null}
              <InfoField label='Venue' value={vm.venueName} />
              <InfoField label='Kick-off' value={formatPdfDate(vm.kickOffAt)} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rincian tiket</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.colItem, styles.colHeaderText]}>Item</Text>
              <Text style={[styles.colPrice, styles.colHeaderText]}>Harga</Text>
            </View>
            {vm.lineItems.map((item, index) => (
              <View
                key={`${item.label}-${index}`}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : undefined]}
              >
                <View style={styles.colItem}>
                  <Text style={styles.lineLabel}>{item.label}</Text>
                  {item.note ? <Text style={styles.lineNote}>{item.note}</Text> : null}
                </View>
                <Text style={[styles.colPrice, styles.linePrice]}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalCard}>
            <Text style={styles.cardTitle}>Ringkasan nominal</Text>
            {vm.kind === 'adjustment' ? (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>Total pendaftaran (referensi)</Text>
                  <Text style={styles.totalRowValue}>{formatCurrencyIdr(vm.registrationTotalIdr)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>Jumlah penyesuaian</Text>
                  <Text style={styles.totalRowValue}>
                    {formatCurrencyIdr(vm.adjustmentAmountIdr ?? 0)}
                  </Text>
                </View>
              </>
            ) : null}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>
                {vm.kind === 'adjustment' ? 'Total tagihan penyesuaian' : 'Total tagihan'}
              </Text>
              <Text style={styles.grandTotalValue}>{formatCurrencyIdr(dueAmount)}</Text>
            </View>
          </View>

          {vm.bank ? (
            <View style={styles.bankCard}>
              <Text style={styles.bankTitle}>Instruksi transfer</Text>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Bank</Text>
                <Text style={styles.bankValue}>{vm.bank.bankName}</Text>
              </View>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>No. rekening</Text>
                <Text style={styles.bankValue}>{vm.bank.accountNumber}</Text>
              </View>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Atas nama</Text>
                <Text style={styles.bankValue}>{vm.bank.accountName}</Text>
              </View>
              <Text style={styles.bankHint}>
                Cantumkan ID pendaftaran pada berita transfer agar verifikasi lebih cepat.
              </Text>
            </View>
          ) : null}
        </View>

        <InvoicePdfFooter vm={vm} />
      </Page>
    </Document>
  )
}
