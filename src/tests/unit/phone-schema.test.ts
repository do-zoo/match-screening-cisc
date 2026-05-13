import { describe, expect, test } from "vitest"
import { phoneValueSchema } from "@/lib/forms/phone-schema"

describe("phoneValueSchema", () => {
  test("valid Indonesian number passes", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "ID",
      nationalNumber: "81234567890",
    })
    expect(result.success).toBe(true)
  })

  test("valid Singapore number passes", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+65",
      countryIso: "SG",
      nationalNumber: "91234567",
    })
    expect(result.success).toBe(true)
  })

  test("empty nationalNumber fails with required message", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "ID",
      nationalNumber: "",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Nomor telepon wajib diisi")
  })

  test("invalid number format fails with invalid message", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "ID",
      nationalNumber: "123",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Nomor telepon tidak valid")
  })

  test("whitespace-only nationalNumber fails with required message only", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "ID",
      nationalNumber: "   ",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Nomor telepon wajib diisi")
    expect(msgs).not.toContain("Nomor telepon tidak valid")
  })

  test("unknown countryIso falls back to invalid message", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+99",
      countryIso: "XX",
      nationalNumber: "81234567890",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Nomor telepon tidak valid")
  })

  test("empty countryCode fails", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "",
      countryIso: "ID",
      nationalNumber: "81234567890",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Pilih kode negara")
  })

  test("missing countryIso fails", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "",
      nationalNumber: "81234567890",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Pilih kode negara")
  })
})
