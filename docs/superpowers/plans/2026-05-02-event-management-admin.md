# Event management (admin) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Owner/Admin event CRUD (list, create, edit) with tiered safeguards when registrations exist, cover upload to Vercel Blob, menu items + PIC helpers sync, slug generation, and tests — matching [`docs/superpowers/specs/2026-05-02-event-management-admin-design.md`](../specs/2026-05-02-event-management-admin-design.md).

**Architecture:** Pure tier/validation helpers in `src/lib/events/` tested with Vitest; Zod payloads in `src/lib/forms/`; `guardOwnerOrAdmin` from `@/lib/actions/guard`; Prisma `$transaction` for event + helpers + menu upsert/sync; blob upload mirrors `uploadImageForRegistration` (Sharp WebP → `putWebpToBlob`). Client UI uses react-hook-form + zod Resolver with sectioned `<Form>` primitives from `src/components/ui/`. Sensitive pricing/PIC changes require `acknowledgeSensitiveChanges === true` in the serialized payload **only when** deltas are detected vs DB.

**Tech Stack:** Next.js App Router (`16.x`), React 19, Prisma (`@prisma/client`), Better Auth helpers already in-repo, `@vercel/blob`, `sanitize-html`, `sharp`, Vitest (`pnpm test`).

**Spec reference:** parent nobar UX in [`docs/superpowers/specs/2026-04-29-nobar-cisc-tangsel-design.md`](../specs/2026-04-29-nobar-cisc-tangsel-design.md).

---

### File structure (planned)

| File | Responsibility |
|------|----------------|
| Modify `src/lib/admin/global-nav-flags.ts` | Show global “Acara” sidebar only when `hasOperationalOwnerParity` so Verifier/viewer helpers are not routed to forbidden CRUD list. |
| Create `src/lib/events/generate-event-slug.ts` | Deterministic ASCII slug base from title + collision suffix loop. |
| Create `src/lib/events/event-admin-defaults.ts` | Read default member/non-member ticket prices for **new** events from env integers (fallback Seed demo values). |
| Create `src/lib/events/event-edit-guards.ts` | Pure locked-field detection, sensitive-change detection helpers. |
| Create `src/lib/events/event-edit-guards.test.ts` | Vitest coverage per spec tiers. |
| Create `src/lib/forms/admin-event-form-schema.ts` | Zod schemas (create/update DTO shapes, ISO datetime strings parsed to `Date`). |
| Create `src/lib/uploads/upload-event-cover.ts` | WebP PUT to `events/{eventId}/cover.webp`, optional delete previous blob URL via `del` from `@vercel/blob`. |
| Create `src/lib/actions/admin-events.ts` | `createAdminEvent`, `updateAdminEvent` Server Actions returning `ActionResult`. |
| Create `src/components/admin/forms/event-admin-edit-form.tsx` | Client wizard-style single form: delegates to modular field components. |
| Create `src/components/admin/forms/event-admin-field-groups.tsx` | Metadata, venue, schedule, pricing, menu config, PIC/bank/helpers, placeholders for description textarea. |
| Create `src/components/admin/forms/event-menu-items-editor.tsx` | Dynamic array FieldArray for EventMenuItem rows. |
| Create `src/components/admin/forms/sensitive-changes-dialog.tsx` | Checkbox ack + Continue sets hidden RHF flag `acknowledgeSensitiveChanges`. |
| Create `src/app/admin/events/new/page.tsx` | RSC loads PIC/bank presets, renders form. |
| Create `src/app/admin/events/[eventId]/edit/page.tsx` | RSC guards + prefetch event + renders edit form initial values. |
| Modify `src/app/admin/events/page.tsx` | Operational table listing + filters + CTA Buat acara (Owner/Admin). |
| Modify `src/components/admin/admin-event-breadcrumbs.tsx` | Crumb branch for `/edit`; link “Acara” → `/admin/events`. |

---

### Task 1: Sidebar flag — operational Acara link only

**Files:**
- Modify: `src/lib/admin/global-nav-flags.ts`
- Test: Manual — sign in Verifier sees no sidebar “Acara”, dashboard cards still navigate to inbox.

- [ ] **Step 1: Change `deriveGlobalSidebarNav`**

Replace the `acara` property so Operational parity gates it (matches [`admin/anggota/page.tsx`](../../../src/app/admin/anggota/page.tsx) visibility pattern).

```typescript
export function deriveGlobalSidebarNav(ctx: AdminContext | null): GlobalSidebarNav {
  return {
    beranda: true,
    acara: ctx !== null && hasOperationalOwnerParity(ctx.role),
    anggota: ctx !== null && hasOperationalOwnerParity(ctx.role),
    pengaturan: ctx !== null && canManageCommitteeAdvancedSettings(ctx.role),
  };
}
```

Ensure `hasOperationalOwnerParity` stays imported alongside `canManageCommitteeAdvancedSettings`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/global-nav-flags.ts
git commit -m "fix(admin): show Acara nav only for Owner and Admin"

```

Expected: Lint clean on changed file (`pnpm lint`).

---

### Task 2: Slug helper + uniqueness

**Files:**
- Create: `src/lib/events/generate-event-slug.ts`
- Create: `src/lib/events/generate-event-slug.test.ts`
- Depends on: `@/lib/db/prisma` duplicate check uses `slug` existence.

Implement **slug generation** strictly on server for create; **never trust** client-sent slug.

```typescript
import type { PrismaClient } from "@prisma/client";

/**
 * Produce URL-safe ASCII slug segments from Indonesian / Latin titles (no diacritics).
 */
export function slugifyEventTitle(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96);
}

/** Returns unique slug by appending `-2`, `-3`, … against `prisma.event`. */
export async function allocateUniqueEventSlug(
  prisma: PrismaClient,
  title: string,
): Promise<string> {
  const base = slugifyEventTitle(title);
  const head = base.length > 0 ? base : "acara";

  let candidate = head;
  let n = 1;
  while (true) {
    const clash = await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${head}-${n}`;
  }
}
```

Tests:

```typescript
import { describe, expect, it } from "vitest";

import { slugifyEventTitle } from "@/lib/events/generate-event-slug";

describe("slugifyEventTitle", () => {
  it("strips punctuation and trims hyphens", () => {
    expect(slugifyEventTitle("  Final — UCL! 2026  ")).toBe("final-ucl-2026");
  });

  it("handles empty input", () => {
    expect(slugifyEventTitle("   ")).toBe("");
  });

  it("removes accented characters", () => {
    expect(slugifyEventTitle("café nöbär")).toBe("cafe-nobar");
  });
});
```

**Note:** `allocateUniqueEventSlug` integration-tested indirectly via Task 7; optional prisma-mocked test omitted (YAGNI).

- [ ] Steps: Implement file → add Vitest unit file → **Run** `pnpm vitest run src/lib/events/generate-event-slug.test.ts` Expected: **PASS**.
- [ ] Commit: `feat(events): add server-side slug helpers`

---

### Task 3: Default ticket env prices

**Files:**
- Create: `src/lib/events/event-admin-defaults.ts`
- Create: `src/lib/events/event-admin-defaults.test.ts`
- Optional doc: Mention new env keys in **`CLAUDE.md`** environment table only if you already maintain it publicly (otherwise README owner note). **Do NOT add new `.md` file** unless repo already expects it.

Defaults match seed demos when env unset (`125_000`, `175_000` copied from [`prisma/seed.ts`](../../../prisma/seed.ts)).

```typescript
function parseIdr(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Global default ticket prices for *new events* until committee Settings UI persists DB row. */
export function getCommitteeTicketDefaults(): {
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
} {
  return {
    ticketMemberPrice: parseIdr(process.env.MATCH_DEFAULT_TICKET_MEMBER_IDR, 125_000),
    ticketNonMemberPrice: parseIdr(process.env.MATCH_DEFAULT_TICKET_NON_MEMBER_IDR, 175_000),
  };
}
```

Test:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCommitteeTicketDefaults } from "@/lib/events/event-admin-defaults";

describe("getCommitteeTicketDefaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses seed-aligned fallbacks when env missing", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "");
    expect(getCommitteeTicketDefaults()).toEqual({
      ticketMemberPrice: 125_000,
      ticketNonMemberPrice: 175_000,
    });
  });

  it("parses overrides", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "90000");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "99000");
    expect(getCommitteeTicketDefaults()).toEqual({
      ticketMemberPrice: 90_000,
      ticketNonMemberPrice: 99_000,
    });
  });
});
```

Operators add to `.env.local` manually:

```
MATCH_DEFAULT_TICKET_MEMBER_IDR=125000
MATCH_DEFAULT_TICKET_NON_MEMBER_IDR=175000
```

- [ ] Steps: files + run vitest targeted file PASS → Commit `feat(events): env-driven ticket defaults for admin create`

---

### Task 4: Tier guard helpers (+ tests)

**Files:**
- Create: `src/lib/events/event-edit-guards.ts`
- Create: `src/lib/events/event-edit-guards.test.ts`

```typescript
import type {
  MenuMode,
  MenuSelection,
  PricingSource,
} from "@prisma/client";

export type EventIntegritySnapshot = {
  slug: string;
  menuMode: MenuMode;
  menuSelection: MenuSelection;
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
  voucherPrice: number | null;
  pricingSource: PricingSource;
  picMasterMemberId: string;
  bankAccountId: string;
};

export type EventIntegrityPatch = Partial<EventIntegritySnapshot>;

export function findLockedViolations(opts: {
  registrationCount: number;
  persisted: EventIntegritySnapshot;
  candidate: EventIntegrityPatch;
}): Array<keyof Pick<
  EventIntegritySnapshot,
  "slug" | "menuMode" | "menuSelection"
>> {
  if (opts.registrationCount === 0) return [];

  const out: Array<"slug" | "menuMode" | "menuSelection"> = [];

  const nextSlug = opts.candidate.slug ?? opts.persisted.slug;
  if (nextSlug !== opts.persisted.slug) out.push("slug");

  const nextMode = opts.candidate.menuMode ?? opts.persisted.menuMode;
  if (nextMode !== opts.persisted.menuMode) out.push("menuMode");

  const nextSel =
    opts.candidate.menuSelection ?? opts.persisted.menuSelection;
  if (nextSel !== opts.persisted.menuSelection) out.push("menuSelection");

  return out;
}

export function needsSensitiveAcknowledgement(opts: {
  persisted: EventIntegritySnapshot;
  candidate: EventIntegrityPatch;
}): boolean {
  const merged = { ...opts.persisted, ...opts.candidate };

  const pricingChanged =
    merged.ticketMemberPrice !== opts.persisted.ticketMemberPrice ||
    merged.ticketNonMemberPrice !== opts.persisted.ticketNonMemberPrice ||
    merged.voucherPrice !== opts.persisted.voucherPrice ||
    merged.pricingSource !== opts.persisted.pricingSource;

  const financeActorChanged =
    merged.picMasterMemberId !== opts.persisted.picMasterMemberId ||
    merged.bankAccountId !== opts.persisted.bankAccountId;

  return pricingChanged || financeActorChanged;
}
```

Tests cover: no violations count 0; locked triple when registrations>0; sensitive trigger on price deltas; insensitive when only description-level fields touched (simulate empty patch `{}` merging).

```typescript
import { describe, expect, it } from "vitest";

import {
  findLockedViolations,
  needsSensitiveAcknowledgement,
  type EventIntegritySnapshot,
} from "@/lib/events/event-edit-guards";

const persisted: EventIntegritySnapshot = {
  slug: "demo",
  menuMode: "PRESELECT",
  menuSelection: "SINGLE",
  ticketMemberPrice: 1,
  ticketNonMemberPrice: 2,
  voucherPrice: null,
  pricingSource: "global_default",
  picMasterMemberId: "m1",
  bankAccountId: "b1",
};

describe("findLockedViolations", () => {
  it("allows everything when registrationCount is 0", () => {
    expect(
      findLockedViolations({
        registrationCount: 0,
        persisted,
        candidate: { slug: "x", menuMode: "VOUCHER", menuSelection: "MULTI" },
      }),
    ).toEqual([]);
  });

  it("blocks slug/menu mutations when registrations exist", () => {
    expect(
      findLockedViolations({
        registrationCount: 3,
        persisted,
        candidate: { slug: "new" },
      }),
    ).toEqual(["slug"]);
    expect(
      findLockedViolations({
        registrationCount: 3,
        persisted,
        candidate: { menuMode: "VOUCHER" },
      }),
    ).toEqual(["menuMode"]);
  });
});

describe("needsSensitiveAcknowledgement", () => {
  it("detects pricing changes but not PIC-only omission", () => {
    expect(
      needsSensitiveAcknowledgement({
        persisted,
        candidate: { ticketMemberPrice: 9 },
      }),
    ).toBe(true);

    expect(
      needsSensitiveAcknowledgement({
        persisted,
        candidate: { voucherPrice: 10 },
      }),
    ).toBe(true);

    expect(
      needsSensitiveAcknowledgement({
        persisted,
        candidate: {},
      }),
    ).toBe(false);
  });
});
```

- [ ] Run `pnpm vitest run src/lib/events/event-edit-guards.test.ts` Expected: **PASS** → Commit `feat(events): add tiered edit guard helpers`.

---

### Task 5: Zod DTO schemas (admin event form)

**Files:**
- Create: `src/lib/forms/admin-event-form-schema.ts`

```typescript
import { z } from "zod";
import {
  EventStatus,
  MenuMode,
  MenuSelection,
  PricingSource,
} from "@prisma/client";

/** ISO string or datetime-local-compatible string interpreted in server as absolute instant (store UTC). */

const idrSchema = z.coerce.number().int().nonnegative();

const menuItemDraftSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  priceIdr: idrSchema,
  sortOrder: z.coerce.number().int().nonnegative(),
  voucherEligible: z.boolean(),
});

export type AdminMenuItemDraft = z.infer<typeof menuItemDraftSchema>;

export const adminEventUpsertSchema = z
  .object({
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    /** Raw HTML sanitized before persistence on server (never trust strip on client-only). */
    descriptionHtml: z.string(),
    venueName: z.string().trim().min(1),
    venueAddress: z.string().trim().min(1),
    /** Accept `new Date(...)` compat strings from serialized JSON payloads. */
    startAtIso: z.string().min(1),
    endAtIso: z.string().min(1),
    registrationCapacity: z.union([idrSchema, z.literal(null)]).optional(),
    registrationManualClosed: z.boolean(),
    status: z.nativeEnum(EventStatus),
    menuMode: z.nativeEnum(MenuMode),
    menuSelection: z.nativeEnum(MenuSelection),
    voucherPriceIdr: z.union([idrSchema, z.literal(null)]),
    pricingSource: z.nativeEnum(PricingSource),
    ticketMemberPrice: idrSchema,
    ticketNonMemberPrice: idrSchema,
    picMasterMemberId: z.string().min(1),
    bankAccountId: z.string().min(1),
    helperMasterMemberIds: z.array(z.string().min(1)),
    menuItems: z.array(menuItemDraftSchema).min(1),
    acknowledgeSensitiveChanges: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const start = Date.parse(v.startAtIso);
    const end = Date.parse(v.endAtIso);
    if (!Number.isFinite(start)) {
      ctx.addIssue({
        code: "custom",
        path: ["startAtIso"],
        message: "Waktu mulai tidak valid.",
      });
    }
    if (!Number.isFinite(end)) {
      ctx.addIssue({
        code: "custom",
        path: ["endAtIso"],
        message: "Waktu selesai tidak valid.",
      });
    }
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["endAtIso"],
        message: "Waktu selesai harus setelah mulai.",
      });
    }
    if (v.menuMode === "VOUCHER") {
      if (v.voucherPriceIdr === null) {
        ctx.addIssue({
          code: "custom",
          path: ["voucherPriceIdr"],
          message: "Harga voucher wajib untuk mode Voucher.",
        });
      }
    } else if (v.voucherPriceIdr !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["voucherPriceIdr"],
        message: "Kosongkan harga voucher jika Mode Menu bukan Voucher.",
      });
    }
  });

export type AdminEventUpsertInput = z.output<typeof adminEventUpsertSchema>;
```

*(No vitest isolated for Zod-only unless brittle superRefines appear—defer.)*

- [ ] Run `pnpm lint` on touched file → Commit `feat(forms): add admin event upsert schema`

---

### Task 6: Cover upload helper

**Files:**
- Create: `src/lib/uploads/upload-event-cover.ts`

Use same mime/size caps as `@/lib/uploads/upload-image`; convert `toWebp`; path `events/{eventId}/cover.webp`; **`allowOverwrite: true`** matches blob helper behavior.

```typescript
import { del } from "@vercel/blob";

import { toWebp } from "@/lib/uploads/images";
import { putWebpToBlob } from "@/lib/uploads/blob";
import { retry } from "@/lib/uploads/retry";
import { UploadError } from "@/lib/uploads/errors";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Upload or replace hero cover image for Event; deletes previous Blob URL best-effort. */
export async function uploadEventHeroCover(opts: {
  eventId: string;
  file: File;
  previousBlobUrl?: string | null;
}): Promise<{ url: string; pathname: string }> {
  const { file } = opts;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new UploadError("Gunakan berkas gambar.", {
      code: "invalid_content_type",
      recoverable: true,
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Ukuran berkas terlalu besar.", {
      code: "file_too_large",
      recoverable: true,
    });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 });
  const blobPath = `events/${opts.eventId}/cover.webp`;

  const putRes = await retry(
    () => putWebpToBlob({ path: blobPath, bytes: webp.bytes }),
    { maxAttempts: 3, delayMs: 250 },
  );

  if (opts.previousBlobUrl?.startsWith("http")) {
    try {
      await del(opts.previousBlobUrl);
    } catch {
      // ignore cleanup failures
    }
  }

  return { url: putRes.url, pathname: putRes.pathname };
}
```

- [ ] Lint + Commit `feat(uploads): add event hero cover upload helper`.

---

### Task 7: Server Actions — create + update

**Files:**
- Create: `src/lib/actions/admin-events.ts`

Imports to wire (adjust relative paths consistently with repo `@/` alias):

- `guardOwnerOrAdmin`, `isAuthError` → `@/lib/actions/guard`
- `prisma` → `@/lib/db/prisma`
- `sanitizePublicEventDescriptionHtml` — **also use on admin save path** (`@/lib/public/sanitize-event-description`) so persisted HTML matches whitelist public renderer already uses.
- `allocateUniqueEventSlug` → `@/lib/events/generate-event-slug`
- `getCommitteeTicketDefaults` → `@/lib/events/event-admin-defaults`
- `findLockedViolations`, `needsSensitiveAcknowledgement` → `@/lib/events/event-edit-guards`
- `adminEventUpsertSchema`, type `AdminEventUpsertInput` → `@/lib/forms/admin-event-form-schema`
- `ok`, `rootError`, `fieldError`, `ActionResult` → `@/lib/forms/action-result`
- `revalidatePath` from `next/cache`
- Random explicit id: **`crypto.randomUUID()`** (`node:crypto` or global `crypto` in Node runtime for Next Server Actions OK)

Skeleton behavior for **`createAdminEvent(serialized)`**:

1. `await guardOwnerOrAdmin()` catching `FORBIDDEN`/`NO_PROFILE` → `rootError("Tidak diizinkan.")`.
2. `JSON.parse` / accept object param typed `unknown` → `adminEventUpsertSchema.safeParse` → else `fieldError`.
3. Load `PicBankAccount` with `ownerMemberId === picMasterMemberId` match `bankAccountId`.
4. Load `MasterMember` ensure `master.canBePIC` true for PIC master AND active.
5. Helpers: dedupe IDs, disallow helper includes PIC Master (strip or error—choose strip + uniqueness).
6. `const id = crypto.randomUUID()`.
7. `const slug = await allocateUniqueEventSlug(prisma, parsed.title)` after validation.
8. `uploadEventHeroCover({ eventId:id, file: coverFile })` **must execute after** prisma create if file uses id—so order: prisma create skeleton with **`coverBlobUrl` / `coverBlobPath` placeholder** forbidden—**instead** upload cover first using **preissued id**:

```typescript
const id = crypto.randomUUID();
const cover = await uploadEventHeroCover({ eventId: id, file: coverPart });
await prisma.event.create({
  data: {
    id,
    slug,
    coverBlobUrl: cover.url,
    coverBlobPath: cover.pathname,
    // ...ticket prices from defaults if pricingSource marks global defaults for create form defaulting
```

9. Persist nested `menuItems` createMany, `helpers` mapping.

**(create pricingSource enforced):** UI default `pricingSource` `global_default` seeds `ticketMemberPrice`/`ticketNonMemberPrice` from `getCommitteeTicketDefaults()` when user selects that mode; **`overridden` requires typed values** unchanged.

**(voucher normalization):** Persist `null` when PRESELECT else Int.

**(transaction):**

```typescript
await prisma.$transaction(async (tx) => {
  await tx.event.create({ /* ...includes menuMode etc */ });
  await tx.eventMenuItem.createMany({
    data: parsed.menuItems.map((m, idx) => ({
      eventId: id,
      name: m.name,
      price: m.priceIdr,
      sortOrder: m.sortOrder ?? idx + 1,
      voucherEligible: m.voucherEligible,
    })),
  });
  if (parsed.helperMasterMemberIds.length) {
    await tx.eventPicHelper.createMany({
      data: parsed.helperMasterMemberIds.map((memberId) => ({
        eventId: id,
        memberId,
      })),
      skipDuplicates: true,
    });
  }
});
```

Revalidate `/admin/events`, `/admin`, `/`.

Return `ok({ eventId:id })`.

**`updateAdminEvent(eventId, payload, coverFile?: File | null)`**:

1. `guardOwnerOrAdmin`.
2. Load event `_count registrations`, `slug`, finances, PIC, helpers, menu items.
3. `safeParse`.
4. `findLockedViolations` → if non-empty → `rootError(`Field ini terkunci karena sudah ada pendaftaran: …`)`.
5. Build `persistedIntegrity` object from loaded row mapping `voucherPrice`.
6. `needsSensitiveAcknowledgement`.

```typescript
const sens = needsSensitiveAcknowledgement({ persisted: persistedIntegrity, candidate: {...} }); // derive candidate slices from parsed
if (sens && !parsed.acknowledgeSensitiveChanges)
  return rootError("Centang pengakuan untuk mengubah harga PIC/rekening/tiket.");
```

7. Re-validate PIC/bank/active helper membership + `helpers` disjoint from PIC.
8. Optionally `uploadEventHeroCover`.
9. **Menu sync transactional algorithm:**

Inside `$transaction`:
- **`deleteMany`** for `EventPicHelper` with `eventId` then **`createMany`** new set (simple snapshot replace).
- For menu items keyed by **`id`** from client:
   - Identify existing DB ids subset.
   - **Delete IDs** absent from incoming list **attempt** (`delete` each) capturing Prisma **`P2003`** → map to Indonesian error `Menu masih digunakan di pendaftaran — hapus gagal.` return **failed transaction** mapping to `ActionResult`.

**Cleaner:** `try { await tx.eventMenuItem.delete({ where:{ id:x } }); } collect codes`.

- **Upsert-ish manual:** iterate payload items:

  - items with **`id`** matching persist update fields.
  - items **without id** insert new rows.

**(Do not recreate all items with deleteMany+createMany** — destroys stable ids unnecessarily and might break concurrency with selects — better update in place.)

10. **`tx.event.update`** merges scalar fields incl. sanitized description.

Errors to map:

- Unauthorized → already generic.
- `UploadError` message passthrough localized at catch boundary.
- Prisma unique slug already impossible on update (slug locked).

11. `revalidatePath` for dashboard, list, public event page when status/slug/title might affect listing: `revalidatePath('/'); revalidatePath('/events'); revalidatePath(`/events/${slug}`)` when slug unchanged else only old path if ever allowed (not when locked).

**Export shapes:** Type `AdminEventUpsertInput` passed as JSON from client (no `File` inside JSON) — **use two arguments:** `(json: unknown, formData?: FormData)` **or** separate `createAdminEventFromFormData(fd: FormData)` pattern like `submit-registration`. **Pick `FormData` wrapper** for cover file ergonomic single submit:

```typescript
function parseJsonField<T>(fd: FormData, key: string): T {
  const raw = fd.get(key);
  if (typeof raw !== "string") throw new Error("MISSING_JSON");
  return JSON.parse(raw) as T;
}
```

So action signature:

```typescript
export async function createAdminEvent(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ eventId: string }>> { /* ... */ }
```

```typescript
const payload = parseJsonField<unknown>(formData, "payload");
const cover = formData.get("cover");
const coverFile = cover instanceof File && cover.size > 0 ? cover : null;
if (!coverFile) return rootError("Sampul acara wajib diunggah.");
```

**Update path** cover optional.

- [ ] Wire actions + run `pnpm lint`
- [ ] Manual smoke via dev server later (Task 12) — **do not claim done without** `pnpm test` full suite PASS at end Task 13.

Commits: split logically `feat(actions): admin createEvent` then `feat(actions): admin updateEvent` if preferred; acceptable single **`feat(actions): admin event CRUD`** if smaller diff review preferred.

---

### Task 8: List page `/admin/events`

**Files:**
- Modify: `src/app/admin/events/page.tsx`

Requirements:

```typescript
export default async function AdminEventsIndexPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  // NO_PROFILE messaging reuse existing card

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const events = await prisma.event.findMany({
    orderBy: [{ startAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startAt: true,
      endAt: true,
      picMasterMember: { select: { fullName: true } },
      _count: { select: { registrations: true } },
    },
  });
```

Render shadcn `Table` from `src/components/ui/table.tsx` (already present) listing with actions:

| Kolom |
|-------|
| Judul (link Pengaturan → `/edit`) |
| Slug monospace |
| Status badge mapping reuse admin page pattern |
| Waktu mulai |
| Nama PIC ringkas |
| Jumlah registrasi |
| Shortcut Inbox `/inbox` link |

Prominent **`Link`/`Button`** `Buat acara` → `/admin/events/new`.

- [ ] `pnpm lint`
- [ ] Commit `feat(admin): event management list`

---

### Task 9: RSC loaders for new/edit + breadcrumbs

**Files:**
- Create: `src/app/admin/events/new/page.tsx`
- Create: `src/app/admin/events/[eventId]/edit/page.tsx`
- Modify: `src/components/admin/admin-event-breadcrumbs.tsx`

**New page** loads Operational guard, prefetch:

- PIC masters: `prisma.masterMember.findMany({ where:{ canBePIC:true, isActive:true }, select:{ id, fullName }} )`
- For default bank preload: optionally first active account grouped by PIC for client `<select>`—return JSON prop to client form.

Serialize defaults `getCommitteeTicketDefaults()` to pass `defaultTicketMemberPrice` props.

**Edit page**:

```typescript
if (!hasOperationalOwnerParity(ctx.role)) notFound();

const event = await prisma.event.findUnique({
  where: { id: eventId },
  include: {
    menuItems: { orderBy: { sortOrder: "asc" } },
    helpers: { select:{ memberId: true } },
  },
});

if (!event) notFound();
```

Pass `registrationCount` via prisma `_count.registrations`.

**AdminEventBreadcrumbs** update to detect pathname `/edit` segment:

Pseudo:

```tsx
const isEdit = pathname === `/admin/events/${eventId}/edit`;
...
if (isEdit) {
  crumbs.unshift second item { label:'Acara', href:'/admin/events' }; // reorder
}
```

Maintain accessibility `aria-current`.

- [ ] Commit `feat(admin): event new/edit pages and breadcrumbs`

---

### Task 10: Client edit form wiring

Because full TSX markup is lengthy, ship **minimal vertical slice**:

**Files:**
- Create: `src/components/admin/forms/event-admin-form.tsx` — `'use client'`, wraps `react-hook-form` `<Form {...form}>`, hidden `<input type="hidden" />` acknowledgment toggled via dialog (`src/components/admin/forms/sensitive-changes-dialog.tsx`).

Expose props:

```tsx
export type EventAdminFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  initialValues?: AdminEventUpsertInput;
  defaultsFromCommittee?: { ticketMemberPrice: number; ticketNonMemberPrice: number };
  picOptions: Array<{ id: string; label: string }>;
  banksByPic: Record<string, Array<{ id:string;label:string }>>;
};
```

Use **`useTransition`** with an async submit handler constructing `FormData` (recommended over raw `useActionState` wrapping for multipart cover + rich JSON blob):

```tsx
const fd = new FormData();
fd.set("payload", JSON.stringify(normalizedPayload));
if (coverInputRef.files?.length) fd.set("cover", coverInputRef.files[0]);
await createAdminEvent(undefined, fd);
```

On success:

```tsx
import { redirect } from "next/navigation"; // ❌ banned in Client — use router.push(`/admin/events/${data.eventId}/edit`) from `next/navigation`
router.push(...)
```

**(Use `router.push`/toast error mapping `result.ok`).**

**(Sensitive dialog):**

```tsx
if (!result.ok && result.rootError?.includes("Centang pengakuan")) openDialog(); // brittle—prefer typed error codes later (YAGNI)
```

**(Menu FieldArray)**

Use `useFieldArray` keyed by `menuItems`; each row `{ name, priceIdr }` numeric inputs masked as integer string then coerced parser.

**(Description)**

Start with `"use client"` + `<textarea rows={12}>` labelled “HTML ringan”; server sanitizes anyway. Document follow-up TinyMCE/editor separate.

**(PIC select)**

Changing PIC triggers client fetch `/api/admin/pic-banks?picId=`—**implement minimal route** guarded by **`guardOwnerOrAdmin` pattern** mirrored from title route returning JSON accounts list Owner or Admin verification.

Additional file:

```typescript
// src/app/api/admin/pic-banks/[memberId]/route.ts
GET -> returns bank rows for operative admin only
```

- [ ] Lint entire components tree → Commit `feat(admin): wired event admin form client`

---

### Task 11: API route PIC bank prefetch

**Files:**
- Create: `src/app/api/admin/pic-banks/[memberId]/route.ts`

Pattern copy [`src/app/api/admin/events/[eventId]/title/route.ts`](../../../src/app/api/admin/events/[eventId]/title/route.ts) auth.

```typescript
export async function GET(_, {params}:{params:Promise<{memberId:string}>}) {
   const session = await getAdminSession();
   ...
   const { memberId } = await params;
   if (!guardOwnerOrAdmin style) ...
   const rows = await prisma.picBankAccount.findMany({
     where: { ownerMemberId: memberId, isActive: true },
     select: { id: true, bankName: true, accountNumber: true, accountName:true },
   });
   return NextResponse.json({
     banks: rows.map(r => ({
        id:r.id,
        label:`${r.bankName} — ${r.accountNumber} (${r.accountName})`
     }))
   });
}
```

- [ ] Commit `feat(api): list PIC banks for operative admin`

---

### Task 12: Layout visibility for PIC helper-only users on `/edit`

**Files:**
- Possibly modify `[eventId]/layout.tsx` breadcrumbs — ensure when Verifier mistakenly hits `/edit` URL they `notFound` early (Operational guard handles). No extra tasks if `notFound` already from page.

Smoke manual script:

```bash
pnpm lint && pnpm test && pnpm build
```

**(Expect build green before merge.)**

---

### Task 13: Final QA commit / polish

- [ ] **Run suite:** `pnpm test` → expect full PASS counts prior baseline **+new tests**.
- [ ] **Lint:** `pnpm lint` ZERO new errors.

```bash
git add -A
git commit -m "test(admin): stabilize event tier helpers"
```
(Only if tweaking tests.)

---

### Self-review (maintainer checklist)

**Spec coverage map**

| Spec section | Task |
|---------------|------|
| Owner/Admin only | Sidebar Task 1, guards Task 7, API route Task 11, pages Task 8–9 |
| IA routes `/admin/events`, `/new`, `/[id]/edit` | Tasks 8–10 |
| Field coverage incl. PIC/helpers/menu | Tasks 5,7,10 |
| Tier locking + ack | Tasks 4,7,10 |
| Cover Blob | Tasks 6,7 |
| Sanitized HTML storage | Task 7 (sanitize reuse) |
| No hard delete MVP | Omit delete action per spec §7 |
| Global defaults fallback | Tasks 3,9 |
| Indonesian errors | Implemented in Tasks 7,10 wording |
| Tests | Tasks 2–4 helpers covered |
| Sidebar misnavigation | Task 1 |

**Placeholder audit:** Removed—only explicit env/README operator instructions.

**Type consistency:** `AdminEventUpsertInput` aligns with prisma ints and enum names; vouchers `number|null`.

**Gap note:** Full rich text WYSIWYG intentionally deferred (textarea + sanitize). Committee DB-backed defaults remain env-based until Pengaturan page ships.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-event-management-admin.md`. Two execution options:

**1. Subagent-driven (recommended)** — dispatch a fresh subagent per task, review output between tasks, fast loops.

**2. Inline execution** — run tasks sequentially in one session (`executing-plans`) using checkbox progression with human checkpoints between clusters (Tasks 1–4 lib, Tasks 6–7 actions, Tasks 8–11 UI/API).

Which approach do you want?
