import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'

import { RegistrationInvoicePdfDocument } from './registration-invoice-pdf-doc'
import { buildInvoicePdfFilename } from './registration-invoice-pdf-filename'
import { resolveInvoicePdfLogoSrc } from './resolve-invoice-pdf-logo-src'
import type { RegistrationInvoicePdfVm } from './registration-invoice-pdf-types'

export async function renderRegistrationInvoicePdf(vm: RegistrationInvoicePdfVm): Promise<{
  buffer: Buffer
  filename: string
  contentType: 'application/pdf'
}> {
  const logoSrc = await resolveInvoicePdfLogoSrc(vm.logoBlobUrl)
  const buffer = await renderToBuffer(createElement(RegistrationInvoicePdfDocument, { vm, logoSrc }))
  const filename = buildInvoicePdfFilename({
    kind: vm.kind,
    eventSlug: vm.eventSlug,
    registrationId: vm.registrationId,
    adjustmentId: vm.adjustmentId,
  })

  return { buffer, filename, contentType: 'application/pdf' }
}
