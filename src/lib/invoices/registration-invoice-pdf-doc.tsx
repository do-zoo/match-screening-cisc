import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'
import type {
  InvoicePdfKind,
  InvoicePdfPaymentStatus,
  RegistrationInvoicePdfVm,
} from './registration-invoice-pdf-types'

const pdfDateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeStyle: 'short',
})

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111' },
  header: { marginBottom: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: 'bold' },
  badge: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },
  badgePaid: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeUnpaid: { backgroundColor: '#fef3c7', color: '#92400e' },
  clubName: { fontSize: 11, color: '#555', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#374151' },
  infoRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  infoLabel: { width: 130, color: '#6b7280' },
  infoValue: { flex: 1, color: '#111' },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 6,
  },
  colItem: { flex: 3 },
  colPrice: { flex: 1, textAlign: 'right' },
  colHeaderText: { fontWeight: 'bold', fontSize: 9, color: '#374151' },
  lineNote: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { color: '#374151' },
  totalValue: { fontWeight: 'bold' },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 'bold' },
  grandTotalValue: { fontSize: 11, fontWeight: 'bold' },
  bankBlock: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  bankTitle: { fontWeight: 'bold', marginBottom: 6, fontSize: 10 },
  footer: { marginTop: 24, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', fontSize: 9, color: '#6b7280' },
})

function invoiceTitle(kind: InvoicePdfKind): string {
  return kind === 'adjustment' ? 'Tagihan Penyesuaian' : 'Tagihan Pendaftaran'
}

function paymentStatusLabel(status: InvoicePdfPaymentStatus): string {
  if (status === 'paid') return 'Lunas'
  if (status === 'unpaid_adjustment') return 'Belum lunas'
  return 'Menunggu pembayaran'
}

function badgeStyle(status: InvoicePdfPaymentStatus) {
  if (status === 'paid') return [styles.badge, styles.badgePaid]
  if (status === 'awaiting_payment' || status === 'unpaid_adjustment') return [styles.badge, styles.badgeUnpaid]
  return styles.badge
}

function formatPdfDate(date: Date): string {
  return pdfDateFormatter.format(date)
}

function amountDueIdr(vm: RegistrationInvoicePdfVm): number {
  if (vm.kind === 'adjustment' && vm.adjustmentAmountIdr != null) return vm.adjustmentAmountIdr
  return vm.registrationTotalIdr
}

export function RegistrationInvoicePdfDocument({ vm }: { vm: RegistrationInvoicePdfVm }) {
  const statusLabel = paymentStatusLabel(vm.paymentStatus)
  const dueAmount = amountDueIdr(vm)

  return (
    <Document>
      <Page size='A4' style={styles.page}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{invoiceTitle(vm.kind)}</Text>
            <Text style={badgeStyle(vm.paymentStatus)}>{statusLabel}</Text>
          </View>
          <Text style={styles.clubName}>{vm.clubNameNav}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi tagihan</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID pendaftaran</Text>
            <Text style={styles.infoValue}>{vm.registrationId}</Text>
          </View>
          {vm.adjustmentId ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ID penyesuaian</Text>
              <Text style={styles.infoValue}>{vm.adjustmentId}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tanggal diterbitkan</Text>
            <Text style={styles.infoValue}>{formatPdfDate(vm.issuedAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nama kontak</Text>
            <Text style={styles.infoValue}>{vm.contactName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Acara</Text>
            <Text style={styles.infoValue}>{vm.eventTitle}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Venue</Text>
            <Text style={styles.infoValue}>{vm.venueName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kick-off</Text>
            <Text style={styles.infoValue}>{formatPdfDate(vm.kickOffAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kategori tiket</Text>
            <Text style={styles.infoValue}>
              {vm.ticketCategoryName} ({vm.ticketQty} tiket)
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rincian tiket</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.colItem, styles.colHeaderText]}>Item</Text>
            <Text style={[styles.colPrice, styles.colHeaderText]}>Harga</Text>
          </View>
          {vm.lineItems.map((item, index) => (
            <View key={`${item.label}-${index}`} style={styles.tableRow}>
              <View style={styles.colItem}>
                <Text>{item.label}</Text>
                {item.note ? <Text style={styles.lineNote}>{item.note}</Text> : null}
              </View>
              <Text style={styles.colPrice}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Total</Text>
          {vm.kind === 'adjustment' ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total pendaftaran (referensi)</Text>
                <Text style={styles.totalValue}>{formatCurrencyIdr(vm.registrationTotalIdr)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Jumlah penyesuaian</Text>
                <Text style={styles.totalValue}>
                  {formatCurrencyIdr(vm.adjustmentAmountIdr ?? 0)}
                </Text>
              </View>
            </>
          ) : null}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>
              {vm.kind === 'adjustment' ? 'Total tagihan penyesuaian' : 'Total tagihan'}
            </Text>
            <Text style={styles.grandTotalValue}>{formatCurrencyIdr(dueAmount)}</Text>
          </View>
        </View>

        {vm.bank ? (
          <View style={styles.bankBlock}>
            <Text style={styles.bankTitle}>Informasi transfer</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bank</Text>
              <Text style={styles.infoValue}>{vm.bank.bankName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. rekening</Text>
              <Text style={styles.infoValue}>{vm.bank.accountNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Atas nama</Text>
              <Text style={styles.infoValue}>{vm.bank.accountName}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          {vm.committeeContactEmail ? (
            <Text>Hubungi komite: {vm.committeeContactEmail}</Text>
          ) : null}
          {vm.paymentStatus === 'paid' && vm.paidAt ? (
            <Text>Lunas pada: {formatPdfDate(vm.paidAt)}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  )
}
