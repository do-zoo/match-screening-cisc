import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SEED_DATA_DIR = join(process.cwd(), 'prisma', 'seed-data')

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

/** Rekursif: string ISO-8601 → Date (untuk field Prisma DateTime). */
export function reviveDates<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    return new Date(value) as T
  }
  if (Array.isArray(value)) {
    return value.map(item => reviveDates(item)) as T
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = reviveDates(v)
    }
    return out as T
  }
  return value
}

export function loadSeedJson<T>(name: string): T[] {
  const path = join(SEED_DATA_DIR, `${name}.json`)
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error(`Seed data ${name}.json harus berupa array JSON`)
  }
  return parsed as T[]
}
