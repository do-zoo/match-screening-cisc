import { describe, expect, it } from 'vitest'

import { buildRegistrationWaNotify } from '@/lib/wa-templates/build-registration-notify'

const baseReg = {
  contactName: 'Budi',
  contactWhatsapp: '081234567890',
  registrationId: 'reg_test_1',
  computedTotalIdr: 200_000,
  ticketQty: 1,
  ticketCategoryName: 'Reguler',
  rejectionReason: 'Bukti tidak jelas',
  paymentIssueReason: 'Nominal kurang',
  event: {
    title: 'Chelsea vs Milan',
    venueName: 'GBK',
    kickOffAt: new Date('2026-08-08T19:00:00+07:00'),
    openGateAt: null as Date | null,
  },
}

describe('buildRegistrationWaNotify', () => {
  it('approved — preview dan href valid', () => {
    const r = buildRegistrationWaNotify({
      kind: 'approved',
      registration: baseReg,
      waBodies: {},
    })
    expect(r.titleId).toContain('disetujui')
    expect(r.preview.length).toBeGreaterThan(10)
    expect(r.canOpen).toBe(true)
    expect(r.href).toMatch(/^https:\/\/wa\.me\/62/)
  })

  it('approved — optional registration_id in custom body', () => {
    const r = buildRegistrationWaNotify({
      kind: 'approved',
      registration: baseReg,
      waBodies: {
        approved:
          'OK *{event_title}* {venue} {start_at_formatted}\nID: {registration_id}',
      },
    })
    expect(r.preview).toContain('reg_test_1')
  })

  it('rejected — butuh alasan', () => {
    const r = buildRegistrationWaNotify({
      kind: 'rejected',
      registration: { ...baseReg, rejectionReason: null },
      waBodies: {},
    })
    expect(r.canOpen).toBe(false)
  })

  it('underpayment_email_reminder — menyebut acara dan nominal', () => {
    const r = buildRegistrationWaNotify({
      kind: 'underpayment_email_reminder',
      registration: baseReg,
      waBodies: {},
      adjustmentAmountIdr: 50_000,
    })
    expect(r.preview).toContain('Chelsea')
    expect(r.preview).toContain('50')
    expect(r.canOpen).toBe(true)
  })

  it('nomor tidak valid — canOpen false', () => {
    const r = buildRegistrationWaNotify({
      kind: 'approved',
      registration: { ...baseReg, contactWhatsapp: 'xxx' },
      waBodies: {},
    })
    expect(r.canOpen).toBe(false)
    expect(r.href).toBe('')
  })
})
