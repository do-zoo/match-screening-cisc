import { describe, expect, it } from 'vitest'

import {
  buildAdminWaTemplatesListUrl,
  parseAdminWaTemplatesListParams,
} from '@/lib/admin/admin-wa-templates-list-url'

describe('admin-wa-templates-list-url', () => {
  it('builds table view url', () => {
    expect(
      buildAdminWaTemplatesListUrl({ tab: 'verifikasi', view: 'table', q: 'disetujui' }),
    ).toBe('/admin/settings/templates/whatsapp?tab=verifikasi&view=tabel&q=disetujui')
  })

  it('parses params', () => {
    expect(
      parseAdminWaTemplatesListParams({ tab: 'operasi', view: 'tabel', q: '  refund ' }),
    ).toEqual({ tab: 'operasi', q: 'refund', view: 'table' })
  })
})
