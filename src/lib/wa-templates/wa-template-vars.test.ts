import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { buildWaTemplateVars, type WaTemplateRenderContext } from '@/lib/wa-templates/wa-template-vars'

const baseCtx: WaTemplateRenderContext = {
  contactName: 'Budi',
  contactWhatsapp: '6281234567890',
  registrationId: 'reg_abc',
  computedTotalIdr: 150000,
  ticketQty: 2,
  ticketCategoryName: 'VIP',
  eventTitle: 'Nobar Final',
  venue: 'Gedung A',
  kickOffAtIso: '2026-07-01T14:00:00.000Z',
  openGateAtIso: '2026-07-01T12:00:00.000Z',
  reason: 'Bukti blur',
  adjustmentAmountIdr: 50000,
  bankName: 'BCA',
  accountNumber: '123',
  accountName: 'CISC',
}

describe('buildWaTemplateVars', () => {
  it('maps approved required fields', () => {
    const vars = buildWaTemplateVars(WaTemplateKey.approved, baseCtx)
    expect(vars.event_title).toBe('Nobar Final')
    expect(vars.venue).toBe('Gedung A')
    expect(vars.start_at_formatted).toMatch(/2026/)
  })

  it('maps optional registration_id', () => {
    const vars = buildWaTemplateVars(WaTemplateKey.approved, baseCtx)
    expect(vars.registration_id).toBe('reg_abc')
  })

  it('formats computed_total_idr', () => {
    const vars = buildWaTemplateVars(WaTemplateKey.receipt, baseCtx)
    expect(vars.computed_total_idr.replace(/\u00a0/g, ' ')).toMatch(/Rp\s?150\.000/)
  })
})
