import { del, list } from '@vercel/blob'

/** Menghapus semua blob di store yang `pathname`-nya diawali `prefix` (paginasi otomatis). */
export async function deleteAllBlobsWithPrefix(prefix: string): Promise<number> {
  const urls: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix, limit: 500, cursor })
    for (const b of page.blobs) urls.push(b.url)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  const batchSize = 100
  for (let i = 0; i < urls.length; i += batchSize) {
    await del(urls.slice(i, i + batchSize))
  }
  return urls.length
}
