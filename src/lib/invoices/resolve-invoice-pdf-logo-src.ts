import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import sharp from 'sharp'

const DEFAULT_LOGO_PATH = join(process.cwd(), 'public', 'logo.webp')

async function toPngDataUri(bytes: Buffer): Promise<string> {
  const png = await sharp(bytes).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

async function loadImageBytes(logoBlobUrl: string | null | undefined): Promise<Buffer | null> {
  if (logoBlobUrl?.trim()) {
    try {
      const res = await fetch(logoBlobUrl.trim())
      if (res.ok) return Buffer.from(await res.arrayBuffer())
    } catch {
      /* fall through to default logo */
    }
  }

  try {
    return await readFile(DEFAULT_LOGO_PATH)
  } catch {
    return null
  }
}

/**
 * react-pdf hanya mendukung PNG/JPEG — logo komite disimpan WebP di Blob.
 * Konversi ke data URI PNG agar tampil di PDF tagihan.
 */
export async function resolveInvoicePdfLogoSrc(
  logoBlobUrl: string | null | undefined,
): Promise<string | null> {
  const bytes = await loadImageBytes(logoBlobUrl)
  if (!bytes) return null

  try {
    return await toPngDataUri(bytes)
  } catch {
    return null
  }
}
