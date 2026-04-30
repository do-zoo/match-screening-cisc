---
title: Frontend Form Rules — RHF + shadcn Form + Zod (Strict)
date: 2026-04-30
project: match-screening
status: approved-in-chat
---

## 1) Purpose

Establish a **single, strict** implementation standard for **all submit/mutation forms** in `match-screening` so that:

- Validation is **consistent** across public + admin surfaces.
- UX is **fast** (client-side feedback) while security is **correct** (server re-validation).
- Reviewability is high: the same mental model applies everywhere.

This doc is a **coding rules spec** (not a UI spec). It complements:

- `docs/superpowers/specs/2026-04-30-nobar-cisc-tangsel-ui-ux-design-system-design.md`
- `docs/superpowers/specs/2026-04-30-nobar-cisc-tangsel-tech-stack-architecture-design.md`

## 2) Scope

### 2.1 In scope (MUST follow these rules)

Any UI that **submits** data and triggers a **mutation**, including but not limited to:

- Public participant registration submit (including uploads)
- Admin actions: approve / reject / payment issue / cancel / refund / attendance marking
- CRUD forms: events, master data, bank accounts, WA templates (if implemented as submit forms)
- Underpayment / invoice adjustment creation and payment proof attachment

### 2.2 Out of scope (May follow, but NOT required)

Non-mutation controls such as:

- Search inputs
- Filter chips/selects
- Sort/pagination controls

If a non-mutation control is implemented as an explicit “submit” experience (e.g., an Apply Filters button), it may optionally follow the same pattern for consistency.

## 3) Locked decisions

For every in-scope form:

- **React Hook Form (RHF) is mandatory**
- **shadcn Form composition is mandatory**
- **Zod schema is mandatory** and acts as the **single source of truth** for the payload shape
- Validation is **double-run**:
  - **Client**: for immediate feedback
  - **Server Action**: always re-validate for correctness and security

## 4) Standard form contract (required pattern)

### 4.1 Single schema per form

Each submit form defines exactly one Zod schema, referenced by both client and server:

- `XxxSchema` — Zod schema
- `XxxInput` — `z.infer<typeof XxxSchema>`

Rules:

- Schema names are stable and searchable (prefer `EventUpsertSchema`, `RegistrationSubmitSchema`, `InboxRejectSchema`).
- No duplicate schemas for “client vs server”. If the server needs extra fields, make them explicit in the contract (see uploads section).

### 4.2 Client-side form (RHF + shadcn Form)

Mandatory:

- `useForm({ resolver: zodResolver(XxxSchema) })`
- Use shadcn Form primitives:
  - `Form`
  - `FormField`
  - `FormItem`
  - `FormLabel`
  - `FormControl`
  - `FormMessage`

Rules:

- **Visible labels** are required for all fields (aligns with accessibility spec).
- Submit button shows a **pending** state and prevents double-submit.
- On submit failure, focus moves to the **first invalid field**.

### 4.3 Server Action validation (mandatory defense-in-depth)

Every Server Action receiving form data MUST:

- Parse + validate using the same `XxxSchema` (or a documented derived server-only schema if necessary).
- Reject invalid inputs **before** any side effects (writes, uploads, state transitions).

Rationale:

- Client-side validation improves UX but is not a security boundary.
- Server Actions must treat the network boundary as untrusted.

## 5) Error contract (how validation failures surface)

### 5.1 Error types

All form submissions must support:

- **Field errors**: attached to specific fields
- **Root/form error**: a single general error message (e.g., network failure, permission denied, unexpected error)

### 5.2 Mapping server errors back to RHF

Rules:

- Server Action returns a structured error payload that can be mapped into:
  - `form.setError("<fieldName>", { message })`
  - `form.setError("root", { message })` (or equivalent pattern)
- The UI MUST render the root error prominently near the submit action and keep it readable in both themes.

### 5.3 Error message style

Validation and upload errors must be:

- **Actionable**: say what to do next (retry, choose another file, compress image, contact admin).
- **Trust-first**: avoid blaming language; be clear and calm.

## 6) Upload rules (transfer proof + optional member card photo)

Uploads are critical flows (see UI/UX spec). Rules:

- Client validation should cover what it can (required/optional, basic size limits, basic type accept).
- Server MUST enforce:
  - file size limit
  - acceptable mime/types (do not trust file extension)
  - image conversion rules (WebP pipeline per architecture spec)

Error UX constraints:

- Always offer a recovery path: retry / replace / remove + reselect.
- The UI should preserve other entered form values when an upload fails.

## 7) Anti-patterns (explicitly forbidden)

- Submit/mutation UI not using RHF.
- Any submit form not using shadcn Form primitives (missing `FormMessage` is a common failure).
- Ad-hoc validation logic in `onSubmit` that duplicates or contradicts Zod.
- Server Action that accepts data and proceeds without Zod parsing.
- “Silent” failures: errors not displayed near the field and/or not recoverable.

## 8) Minimal testing bar

### 8.1 Schema tests

For schemas that protect important business flows (registration submit, admin status transitions, payment proof), add focused tests covering:

- required fields
- edge formats (WhatsApp formatting/normalization if applied)
- file metadata constraints (where represented in schema)

### 8.2 Action-level tests (where practical)

Server Actions should be testable for:

- invalid payload → structured field errors
- unauthorized actor → root error (or typed auth error)
- success path → expected state transition / return payload

## 9) Rollout & enforcement

- New forms MUST follow this spec.
- Existing forms should be migrated when touched for feature work.
- Code review checklist (for any submit form PR):
  - Is there a single Zod schema powering client + server?
  - Is RHF used with `zodResolver`?
  - Is shadcn Form composition used correctly (including `FormMessage`)?
  - Does the server action re-validate before side effects?
  - Are errors actionable and recoverable (especially uploads)?

