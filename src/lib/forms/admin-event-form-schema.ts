import { z } from 'zod'
import { EventStatus } from '@prisma/client'

const idrSchema = z.coerce.number().int().nonnegative()

const linkedVenueMenuItemSchema = z.object({
  venueMenuItemId: z.string().min(1),
  /** Urutan tampilan di acara; jika kosong dipakai `VenueMenuItem.sortOrder`. */
  sortOrder: idrSchema.optional(),
})

export type LinkedVenueMenuItemDraft = z.infer<typeof linkedVenueMenuItemSchema>

export const adminEventUpsertSchema = z
  .object({
    title: z.string().trim().min(1, 'Judul acara wajib.'),
    summary: z.string().trim().min(1, 'Ringkasan acara wajib.'),
    /** Raw HTML sanitized before persistence on server (never trust strip on client-only). */
    descriptionHtml: z.string(),
    venueId: z.string().min(1, 'Venue wajib.'),
    linkedVenueMenuItems: z.array(linkedVenueMenuItemSchema).min(1, 'Min 1 menu item.'),
    openRegistrationAtIso: z.string().min(1, 'Waktu buka registrasi wajib.'),
    closeRegistrationAtIso: z.string().min(1, 'Waktu tutup registrasi wajib.'),
    openGateAtIso: z.string().min(1, 'Waktu buka gate wajib.'),
    kickOffAtIso: z.string().min(1, 'Waktu mulai acara wajib.'),
    mandatoryMenuItemIds: z.array(z.string().min(1)),
    /** 0 atau kosong = tak terbatas; nilai negatif ditolak. */
    registrationCapacity: z.preprocess(
      v => (v === 0 || v === '0' ? null : v),
      z.union([z.coerce.number().int().positive(), z.literal(null)]).optional(),
    ),
    registrationManualClosed: z.boolean(),
    status: z.nativeEnum(EventStatus),
    multiCategoryPurchase: z.boolean().optional(),
    picAdminProfileId: z.string().min(1, 'PIC wajib.'),
    bankAccountId: z.string().min(1, 'Rekening bank wajib.'),
    helperAdminProfileIds: z.array(z.string().min(1)),
    acknowledgeSensitiveChanges: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const openReg = Date.parse(v.openRegistrationAtIso)
    const closeReg = Date.parse(v.closeRegistrationAtIso)
    const openGate = Date.parse(v.openGateAtIso)
    const kickOff = Date.parse(v.kickOffAtIso)

    if (!Number.isFinite(openReg)) {
      ctx.addIssue({
        code: 'custom',
        path: ['openRegistrationAtIso'],
        message: 'Waktu buka registrasi tidak valid.',
      })
    }
    if (!Number.isFinite(closeReg)) {
      ctx.addIssue({
        code: 'custom',
        path: ['closeRegistrationAtIso'],
        message: 'Waktu tutup registrasi tidak valid.',
      })
    }
    if (Number.isFinite(openReg) && Number.isFinite(closeReg) && closeReg <= openReg) {
      ctx.addIssue({
        code: 'custom',
        path: ['closeRegistrationAtIso'],
        message: 'Registrasi harus ditutup setelah dibuka.',
      })
    }

    if (!Number.isFinite(openGate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['openGateAtIso'],
        message: 'Waktu buka gate tidak valid.',
      })
    }
    if (!Number.isFinite(kickOff)) {
      ctx.addIssue({
        code: 'custom',
        path: ['kickOffAtIso'],
        message: 'Waktu mulai acara tidak valid.',
      })
    }
    if (Number.isFinite(openGate) && Number.isFinite(kickOff) && kickOff <= openGate) {
      ctx.addIssue({
        code: 'custom',
        path: ['kickOffAtIso'],
        message: 'Acara harus dimulai setelah gate dibuka.',
      })
    }

    const linked = new Set(v.linkedVenueMenuItems.map(x => x.venueMenuItemId))
    for (let i = 0; i < v.mandatoryMenuItemIds.length; i++) {
      const id = v.mandatoryMenuItemIds[i]!
      if (!linked.has(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['mandatoryMenuItemIds', i],
          message: 'Menu wajib harus termasuk item menu acara.',
        })
      }
    }

    const seen = new Set<string>()
    for (let i = 0; i < v.linkedVenueMenuItems.length; i++) {
      const row = v.linkedVenueMenuItems[i]!
      if (seen.has(row.venueMenuItemId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['linkedVenueMenuItems', i, 'venueMenuItemId'],
          message: 'Item menu tidak boleh duplikat untuk satu acara.',
        })
      }
      seen.add(row.venueMenuItemId)
    }
  })

export type AdminEventUpsertInput = z.output<typeof adminEventUpsertSchema>
