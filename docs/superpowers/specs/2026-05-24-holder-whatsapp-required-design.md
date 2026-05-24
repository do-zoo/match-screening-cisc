# Design: Holder WhatsApp Required for Secondary Participants

**Date:** 2026-05-24
**Status:** Approved

## Problem

`holderWhatsapp` in `holderSchema` is currently `optional()` with no phone validation. The UI labels it "(opsional)" for all holders. The committee needs a valid WhatsApp number for every non-primary participant so they can be contacted directly.

## Decision

- **Primary holder (Tiket 1):** No WA field shown. `holderWhatsapp` is derived from the top-level `contactWhatsapp` value, which the registrant already provides.
- **Secondary holders (Tiket 2+):** WhatsApp field is always shown and **required**, with full phone validation.

## Approach: Pre-submit auto-set + uniform schema

`holderWhatsapp` becomes required and validated in the schema for **all** holders. The client syncs `contactWhatsapp → holders[0].holderWhatsapp` at two points so the primary holder always passes validation without showing a field.

## Changes

### 1. `src/lib/forms/submit-registration-schema.ts`

- Rename `contactWhatsappSchema` → `whatsappPhoneSchema` and export it.
- Change `holderSchema.holderWhatsapp` from `z.string().trim().optional()` to `whatsappPhoneSchema`.
- `contactWhatsapp` in `submitRegistrationSchema` continues to use `whatsappPhoneSchema`.

```ts
export const whatsappPhoneSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const e164 = toE164PlusForValidation(val)
    if (!e164) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WhatsApp wajib diisi' })
      return
    }
    if (!isValidPhoneNumber(e164)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nomor WhatsApp tidak valid' })
    }
  })

export const holderSchema = z.object({
  holderName: z.string().trim().min(1, 'Nama pemegang tiket wajib diisi'),
  holderWhatsapp: whatsappPhoneSchema,
  claimedMemberNumber: z.string().trim().optional(),
  mandatoryMenuItemId: z.string().optional(),
})
```

### 2. `src/components/public/registration-form/holder-card.tsx`

**Primary holder (`isPrimary === true`):**

- Do not render `WhatsAppField` in either the non-member path or the member-verified-no-WA path.
- Do not render the `memberVerifiedNoWa` alert — WA is already captured by `contactWhatsapp`.

**Secondary holders:**

- `WhatsAppField` renders as before in both non-member and member-no-WA paths.
- Remove `(opsional)` from the label — the field is now required.

### 3. `src/components/public/registration-form/registration-form.tsx`

Sync `contactWhatsapp → holders[0].holderWhatsapp` at two points:

**`handleNext`** — before `form.trigger()`:

```ts
async function handleNext() {
  form.setValue('holders.0.holderWhatsapp', form.getValues('contactWhatsapp'))
  const valid = await form.trigger()
  if (valid) setStep(2)
}
```

**`onSubmit`** — before building `formData`:

```ts
async function onSubmit(values: SubmitRegistrationInput) {
  const holdersToSubmit = values.holders.map((h, i) =>
    i === 0 ? { ...h, holderWhatsapp: values.contactWhatsapp } : h
  )
  formData.append('holders', JSON.stringify(holdersToSubmit))
  ...
}
```

No changes to the server action — it already validates via `submitRegistrationSchema`.

### 4. `src/lib/forms/submit-registration-schema.test.ts`

- Update all fixture payloads to include `holderWhatsapp` for each holder.
- Add test: secondary holder missing WA → schema rejects.
- Add test: secondary holder with invalid WA → schema rejects.
- Add test: primary holder WA set from contactWhatsapp → schema accepts.

## Invariants

- `holderWhatsapp` for index 0 in the DB will always equal `contactWhatsapp` for new registrations.
- Existing registrations with null `holderWhatsapp` on index 0 are unaffected (DB column stays nullable).
- Member auto-fill from directory continues to work: if the directory has a WA, `setValue` sets it before validation; if not, the field is shown and required for secondary holders.
