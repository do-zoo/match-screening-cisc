import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  getEmailTemplateEntry,
  sampleVarsFromCatalog,
} from '@/lib/email-templates/email-template-catalog'
import { sampleTransactionLineItemsJson } from '@/lib/email-templates/email-transaction-line-items'
import { renderEmailFromBlocks } from '@/lib/email-templates/render-email-from-blocks'

describe('renderEmailFromBlocks', () => {
  it('registration approved html contains registration id in summary table', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const { html, text } = await renderEmailFromBlocks({
      key: EmailTemplateKey.registration_approved,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: {
        ...sampleVarsFromCatalog(entry),
        transaction_line_items_json: sampleTransactionLineItemsJson(),
      },
    })
    expect(html).toContain('clxyz123abc')
    expect(html).toContain('Nomor pemesanan')
    expect(html).toContain('Ringkasan acara')
    expect(html).toContain('Ringkasan pesanan')
    expect(html).toContain('Total terverifikasi')
    expect(html).toContain('Waktu acara')
    expect(text).toContain('Nomor pemesanan: clxyz123abc')
    expect(text).toContain('Rp850.000')
  })

  it('compact rincian (pemegang sama) html has padding on price column', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice)
    const sameHolderItems = [
      { sortOrder: 1, holderName: 'EDWAR', menuName: null, label: 'Tiket #1 · EDWAR', value: 'Rp2.000.000' },
      { sortOrder: 2, holderName: 'EDWAR', menuName: null, label: 'Tiket #2 · EDWAR', value: 'Rp2.000.000' },
      { sortOrder: 3, holderName: 'EDWAR', menuName: null, label: 'Tiket #3 · EDWAR', value: 'Rp2.000.000' },
    ]
    const { html } = await renderEmailFromBlocks({
      key: EmailTemplateKey.invoice,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: {
        ...sampleVarsFromCatalog(entry),
        transaction_line_items_json: JSON.stringify(sameHolderItems),
      },
    })
    expect(html).toContain('Pemegang tiket: EDWAR')
    expect(html).not.toContain('pemegang berbeda per baris')
    expect(html).toContain('max-width:100%')
    expect(html).not.toMatch(/margin:0\s+16px/i)
  })

  it('rincian pemegang berbeda menampilkan kolom Pemegang tiket dan Menu', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice)
    const { html } = await renderEmailFromBlocks({
      key: EmailTemplateKey.invoice,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: {
        ...sampleVarsFromCatalog(entry),
        transaction_line_items_json: sampleTransactionLineItemsJson(),
      },
    })
    expect(html).toContain('pemegang dan menu per baris')
    expect(html).toContain('Budi Santoso')
    expect(html).toContain('Siti Rahayu')
    expect(html).toContain('Paket dinner')
  })

  it('invoice html renders ringkasan tagihan as label-value rows', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice)
    const { html, text } = await renderEmailFromBlocks({
      key: EmailTemplateKey.invoice,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: {
        ...sampleVarsFromCatalog(entry),
        transaction_line_items_json: sampleTransactionLineItemsJson(),
      },
    })
    expect(html).toContain('Total tagihan')
    expect(html).toContain('Rincian tiket')
    expect(html).toContain('max-width:100%')
    expect(html).toContain('Pemegang')
    expect(html).toContain('Budi Santoso')
    expect(html).toContain('Instruksi transfer')
    expect(html).toContain('Rp850.000')
    expect(text).toContain('Total tagihan: Rp850.000')
  })

  it('underpayment invoice html contains sample bank name', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    const { html, text } = await renderEmailFromBlocks({
      key: EmailTemplateKey.invoice_underpayment,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: sampleVarsFromCatalog(entry),
    })
    expect(html).toContain('BCA')
    expect(text).toContain('Budi')
  })

  it('includes contact email in html when branding contact set', async () => {
    const prevOrigin = process.env.BETTER_AUTH_URL
    process.env.BETTER_AUTH_URL = 'https://test.example'
    try {
      const entry = getEmailTemplateEntry(EmailTemplateKey.magic_link)
      const { html, text } = await renderEmailFromBlocks({
        key: EmailTemplateKey.magic_link,
        subject: entry.defaultSubject,
        blocks: entry.defaultBlocks,
        vars: sampleVarsFromCatalog(entry),
        contact: {
          contactEmail: 'komite@example.com',
          websiteUrl: 'https://cisc.example',
          locationText: 'Tangerang Selatan',
          socialLinks: [{ label: 'Instagram', url: 'https://instagram.com/cisc' }],
        },
      })
      expect(html).toContain('komite@example.com')
      expect(html).toContain('Tangerang Selatan')
      expect(html).toContain('/branding-icons/email.png')
      expect(text).toContain('komite@example.com')
    } finally {
      if (prevOrigin === undefined) delete process.env.BETTER_AUTH_URL
      else process.env.BETTER_AUTH_URL = prevOrigin
    }
  })
})
