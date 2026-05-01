# Admin registration ticket & seat context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show read-only “Konteks tiket & kursi” on `admin/.../inbox/[registrationId]`: partner summary, directory pengurus flag for primary member, and cross-registration member-number conflict links—without changing approve/reject.

**Architecture:** Pure helpers in `src/lib/registrations/admin-ticket-context.ts` (TDD) shape partner/pengurus inputs and aggregate conflict rows. `src/lib/registrations/load-admin-ticket-context.ts` runs Prisma reads (batch conflict query + optional `getActiveMasterMemberByMemberNumber`). The RSC page wraps load in `try/catch` and passes a discriminated `TicketContextVm` into `RegistrationDetail`, which renders one extra `Card`.

**Tech stack:** Next.js App Router RSC, Prisma, React 19, Vitest, existing shadcn `Card` / `Link`.

**Spec:** `docs/superpowers/specs/2026-05-02-admin-registration-ticket-context-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/registrations/admin-ticket-context.ts` | Pure: primary number resolution, partner summary, price-type labels, `aggregateCrossRegistrationConflicts`, exported `TicketContextVm` type builders used by loader |
| `src/lib/registrations/admin-ticket-context.test.ts` | Vitest for all pure functions |
| `src/lib/registrations/load-admin-ticket-context.ts` | Async: Prisma conflict query + directory lookup → `TicketContextVm` (`kind: "ok"`) |
| `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx` | Call loader; on throw return `kind: "error"`; pass `ticketContext` prop |
| `src/components/admin/registration-detail.tsx` | New prop `ticketContext`; UI `Card` “Konteks tiket & kursi” |

---

### Task 1: Pure helpers + unit tests (TDD)

**Files:**
- Create: `src/lib/registrations/admin-ticket-context.ts`
- Create: `src/lib/registrations/admin-ticket-context.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `src/lib/registrations/admin-ticket-context.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { TicketPriceType, TicketRole } from "@prisma/client";

import {
  aggregateCrossRegistrationConflicts,
  formatTicketPriceTypeLabel,
  partnerSummaryFromTickets,
  resolvePrimaryMemberNumberForDirectoryLookup,
} from "./admin-ticket-context";

describe("resolvePrimaryMemberNumberForDirectoryLookup", () => {
  it("uses primary ticket memberNumber when set", () => {
    const n = resolvePrimaryMemberNumberForDirectoryLookup(
      [
        { role: "primary" as TicketRole, memberNumber: "M-01" },
        { role: "partner" as TicketRole, memberNumber: "M-02" },
      ],
      "M-99",
    );
    expect(n).toBe("M-01");
  });

  it("falls back to claimedMemberNumber when primary ticket has no number", () => {
    const n = resolvePrimaryMemberNumberForDirectoryLookup(
      [{ role: "primary" as TicketRole, memberNumber: null }],
      "M-99",
    );
    expect(n).toBe("M-99");
  });

  it("trims whitespace", () => {
    const n = resolvePrimaryMemberNumberForDirectoryLookup(
      [{ role: "primary" as TicketRole, memberNumber: "  X  " }],
      null,
    );
    expect(n).toBe("X");
  });

  it("returns null when nothing usable", () => {
    expect(
      resolvePrimaryMemberNumberForDirectoryLookup(
        [{ role: "primary" as TicketRole, memberNumber: null }],
        null,
      ),
    ).toBeNull();
  });
});

describe("partnerSummaryFromTickets", () => {
  it("returns null when no partner ticket", () => {
    expect(
      partnerSummaryFromTickets([
        {
          role: "primary" as TicketRole,
          fullName: "A",
          whatsapp: null,
          memberNumber: "1",
          ticketPriceType: "member" as TicketPriceType,
        },
      ]),
    ).toBeNull();
  });

  it("returns summary for partner row", () => {
    const s = partnerSummaryFromTickets([
      {
        role: "primary" as TicketRole,
        fullName: "A",
        whatsapp: null,
        memberNumber: "1",
        ticketPriceType: "member" as TicketPriceType,
      },
      {
        role: "partner" as TicketRole,
        fullName: "B",
        whatsapp: "6281",
        memberNumber: "2",
        ticketPriceType: "privilege_partner_member_price" as TicketPriceType,
      },
    ]);
    expect(s).toEqual({
      fullName: "B",
      whatsapp: "6281",
      memberNumber: "2",
      ticketPriceType: "privilege_partner_member_price",
      ticketPriceTypeLabel: formatTicketPriceTypeLabel("privilege_partner_member_price"),
    });
  });
});

describe("formatTicketPriceTypeLabel", () => {
  it.each([
    ["member" as TicketPriceType, "Member"],
    ["non_member" as TicketPriceType, "Non-member"],
    [
      "privilege_partner_member_price" as TicketPriceType,
      "Harga istimewa (tiket partner)",
    ],
  ])("maps %s", (t, label) => {
    expect(formatTicketPriceTypeLabel(t)).toBe(label);
  });
});

describe("aggregateCrossRegistrationConflicts", () => {
  it("returns empty for empty input", () => {
    expect(aggregateCrossRegistrationConflicts([])).toEqual([]);
  });

  it("dedupes by registrationId and merges member numbers", () => {
    const out = aggregateCrossRegistrationConflicts([
      { registrationId: "r1", contactName: "Az", memberNumber: "100" },
      { registrationId: "r1", contactName: "Az", memberNumber: "100" },
      { registrationId: "r1", contactName: "Az", memberNumber: "200" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      registrationId: "r1",
      contactName: "Az",
      memberNumbers: ["100", "200"],
    });
  });

  it("sorts memberNumbers and sorts rows by contactName (id locale)", () => {
    const out = aggregateCrossRegistrationConflicts([
      { registrationId: "b", contactName: "Budi", memberNumber: "2" },
      { registrationId: "a", contactName: "Andi", memberNumber: "1" },
    ]);
    expect(out.map((x) => x.registrationId)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/registrations/admin-ticket-context.test.ts
```

Expected: FAIL (module `./admin-ticket-context` missing or exports undefined).

- [ ] **Step 3: Implement `src/lib/registrations/admin-ticket-context.ts`**

```typescript
import type { TicketPriceType, TicketRole } from "@prisma/client";

export function resolvePrimaryMemberNumberForDirectoryLookup(
  tickets: ReadonlyArray<{ role: TicketRole; memberNumber: string | null }>,
  claimedMemberNumber: string | null,
): string | null {
  const primary = tickets.find((t) => t.role === "primary");
  const fromTicket = primary?.memberNumber?.trim();
  if (fromTicket) return fromTicket;
  const c = claimedMemberNumber?.trim();
  return c ? c : null;
}

export function formatTicketPriceTypeLabel(t: TicketPriceType): string {
  if (t === "member") return "Member";
  if (t === "non_member") return "Non-member";
  return "Harga istimewa (tiket partner)";
}

export function partnerSummaryFromTickets(
  tickets: ReadonlyArray<{
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
    ticketPriceType: TicketPriceType;
  }>,
):
  | {
      fullName: string;
      whatsapp: string | null;
      memberNumber: string | null;
      ticketPriceType: TicketPriceType;
      ticketPriceTypeLabel: string;
    }
  | null {
  const p = tickets.find((t) => t.role === "partner");
  if (!p) return null;
  return {
    fullName: p.fullName,
    whatsapp: p.whatsapp,
    memberNumber: p.memberNumber,
    ticketPriceType: p.ticketPriceType,
    ticketPriceTypeLabel: formatTicketPriceTypeLabel(p.ticketPriceType),
  };
}

/** Rows must already exclude the current registration (query responsibility). */
export function aggregateCrossRegistrationConflicts(
  rows: ReadonlyArray<{
    registrationId: string;
    contactName: string;
    memberNumber: string;
  }>,
): Array<{
  registrationId: string;
  contactName: string;
  memberNumbers: string[];
}> {
  const map = new Map<string, { contactName: string; nums: Set<string> }>();

  for (const r of rows) {
    const id = r.registrationId;
    let e = map.get(id);
    if (!e) {
      e = { contactName: r.contactName, nums: new Set() };
      map.set(id, e);
    }
    e.nums.add(r.memberNumber);
  }

  return [...map.entries()]
    .map(([registrationId, v]) => ({
      registrationId,
      contactName: v.contactName,
      memberNumbers: [...v.nums].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.contactName.localeCompare(b.contactName, "id"));
}

export type TicketContextPengurusVm =
  | { state: "no_primary_number" }
  | { state: "not_in_directory" }
  | { state: "found"; isPengurus: boolean };

export type TicketConflictRowVm = {
  registrationId: string;
  contactName: string;
  memberNumbers: string[];
};

export type TicketContextVm =
  | {
      kind: "ok";
      partner: {
        fullName: string;
        whatsapp: string | null;
        memberNumber: string | null;
        ticketPriceType: TicketPriceType;
        ticketPriceTypeLabel: string;
      } | null;
      pengurus: TicketContextPengurusVm;
      conflicts: TicketConflictRowVm[];
    }
  | { kind: "error"; message: string };
```

- [ ] **Step 4: Run tests — expect PASS**

Run:

```bash
pnpm vitest run src/lib/registrations/admin-ticket-context.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/registrations/admin-ticket-context.ts src/lib/registrations/admin-ticket-context.test.ts
git commit -m "feat(admin): pure helpers for registration ticket context"
```

---

### Task 2: Prisma loader

**Files:**
- Create: `src/lib/registrations/load-admin-ticket-context.ts`

- [ ] **Step 1: Add loader implementation**

Create `src/lib/registrations/load-admin-ticket-context.ts`:

```typescript
import type { TicketPriceType, TicketRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getActiveMasterMemberByMemberNumber } from "@/lib/members/lookup-master-member";

import {
  aggregateCrossRegistrationConflicts,
  partnerSummaryFromTickets,
  resolvePrimaryMemberNumberForDirectoryLookup,
  type TicketContextVm,
} from "./admin-ticket-context";

type RegistrationForContext = {
  id: string;
  claimedMemberNumber: string | null;
  tickets: Array<{
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
    ticketPriceType: TicketPriceType;
  }>;
};

export async function loadTicketContextVm(input: {
  eventId: string;
  registration: RegistrationForContext;
}): Promise<Extract<TicketContextVm, { kind: "ok" }>> {
  const { eventId, registration } = input;

  const partner = partnerSummaryFromTickets(registration.tickets);

  const primaryNum = resolvePrimaryMemberNumberForDirectoryLookup(
    registration.tickets,
    registration.claimedMemberNumber,
  );

  let pengurus: Extract<TicketContextVm, { kind: "ok" }>["pengurus"];
  if (!primaryNum) {
    pengurus = { state: "no_primary_number" };
  } else {
    const row = await getActiveMasterMemberByMemberNumber(primaryNum);
    if (!row) {
      pengurus = { state: "not_in_directory" };
    } else {
      pengurus = { state: "found", isPengurus: row.isPengurus };
    }
  }

  const nums = [
    ...new Set(
      registration.tickets
        .map((t) => t.memberNumber?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  let conflictsFlat: Array<{
    registrationId: string;
    contactName: string;
    memberNumber: string;
  }> = [];

  if (nums.length > 0) {
    const otherTickets = await prisma.ticket.findMany({
      where: {
        eventId,
        registrationId: { not: registration.id },
        memberNumber: { in: nums },
      },
      select: {
        memberNumber: true,
        registration: {
          select: { id: true, contactName: true },
        },
      },
    });

    conflictsFlat = otherTickets
      .filter((t) => t.memberNumber !== null)
      .map((t) => ({
        registrationId: t.registration.id,
        contactName: t.registration.contactName,
        memberNumber: t.memberNumber as string,
      }));
  }

  const conflicts = aggregateCrossRegistrationConflicts(conflictsFlat);

  return {
    kind: "ok",
    partner,
    pengurus,
    conflicts,
  };
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors related to new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/registrations/load-admin-ticket-context.ts
git commit -m "feat(admin): load ticket context VM for registration detail"
```

---

### Task 3: Wire RSC page + pass prop

**Files:**
- Modify: `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx`

- [ ] **Step 1: Import loader and build `ticketContext`**

After `registration` is loaded and `notFound()` guarded, add:

```typescript
import type { TicketContextVm } from "@/lib/registrations/admin-ticket-context";
import { loadTicketContextVm } from "@/lib/registrations/load-admin-ticket-context";

// ...inside component after `if (!registration) notFound();`:

let ticketContext: TicketContextVm;
try {
  ticketContext = await loadTicketContextVm({
    eventId,
    registration: {
      id: registration.id,
      claimedMemberNumber: registration.claimedMemberNumber,
      tickets: registration.tickets.map((t) => ({
        role: t.role,
        fullName: t.fullName,
        whatsapp: t.whatsapp,
        memberNumber: t.memberNumber,
        ticketPriceType: t.ticketPriceType,
      })),
    },
  });
} catch {
  ticketContext = {
    kind: "error",
    message: "Tidak dapat memuat konteks kursi.",
  };
}
```

Pass to JSX:

```tsx
<RegistrationDetail
  eventId={eventId}
  registration={registration}
  ticketContext={ticketContext}
/>
```

- [ ] **Step 2: Run typecheck after Task 4**

After Task 4 adds `ticketContext` to `RegistrationDetail`, run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit page + detail together**

```bash
git add src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx src/components/admin/registration-detail.tsx
git commit -m "feat(admin): ticket context panel on registration detail"
```

(Optionally split into two commits if you implemented Task 3 before Task 4; preference is **one commit** once both compile.)

---

### Task 4: `RegistrationDetail` UI card

**Files:**
- Modify: `src/components/admin/registration-detail.tsx`

- [ ] **Step 1: Extend props and render card**

Add imports:

```typescript
import Link from "next/link";
import type { TicketContextVm } from "@/lib/registrations/admin-ticket-context";
```

Extend `Props`:

```typescript
type Props = {
  eventId: string;
  registration: DetailRegistration;
  ticketContext: TicketContextVm;
};
```

Destructuring: `export function RegistrationDetail({ eventId, registration, ticketContext }: Props)`

Insert **immediately before** the existing `<Card>` whose title is `Tickets` (line ~322 in current file), a new card:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Konteks tiket &amp; kursi</CardTitle>
    <CardDescription>
      Informasi baca-saja untuk verifikasi (hak tiket partner, pengurus, bentrok nomor).
    </CardDescription>
  </CardHeader>
  <CardContent className="grid gap-4 text-sm">
    {ticketContext.kind === "error" ? (
      <p className="text-muted-foreground">{ticketContext.message}</p>
    ) : (
      <>
        <div className="grid gap-1">
          <div className="font-medium">Pengurus (dari direktori, nomor utama)</div>
          {ticketContext.pengurus.state === "no_primary_number" && (
            <p className="text-muted-foreground">
              Tidak ada nomor member pada tiket utama / klaim — lookup tidak dijalankan.
            </p>
          )}
          {ticketContext.pengurus.state === "not_in_directory" && (
            <p className="text-amber-700 dark:text-amber-400">
              Nomor utama tidak ditemukan di direktori member aktif.
            </p>
          )}
          {ticketContext.pengurus.state === "found" && (
            <p>
              Status komite/pengurus:{" "}
              <span className="font-medium">
                {ticketContext.pengurus.isPengurus ? "Ya" : "Tidak"}
              </span>
            </p>
          )}
        </div>

        <div className="grid gap-1">
          <div className="font-medium">Tiket partner</div>
          {!ticketContext.partner ? (
            <p className="text-muted-foreground">Tidak ada tiket partner.</p>
          ) : (
            <ul className="list-inside list-disc text-muted-foreground">
              <li>Nama: {ticketContext.partner.fullName}</li>
              <li>
                WhatsApp:{" "}
                {ticketContext.partner.whatsapp ?? (
                  <span className="italic">-</span>
                )}
              </li>
              <li>
                Nomor member:{" "}
                {ticketContext.partner.memberNumber ?? (
                  <span className="italic">-</span>
                )}
              </li>
              <li>Tipe harga: {ticketContext.partner.ticketPriceTypeLabel}</li>
            </ul>
          )}
        </div>

        <div className="grid gap-1">
          <div className="font-medium">Bentrok nomor (event ini)</div>
          {ticketContext.conflicts.length === 0 ? (
            <p className="text-muted-foreground">
              Tidak ada registrasi lain dengan nomor member yang sama pada tiket.
            </p>
          ) : (
            <ul className="list-inside list-disc space-y-2">
              {ticketContext.conflicts.map((c) => (
                <li key={c.registrationId}>
                  <span className="text-muted-foreground">
                    {c.contactName} — nomor: {c.memberNumbers.join(", ")} —{" "}
                  </span>
                  <Link
                    href={`/admin/events/${eventId}/inbox/${c.registrationId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    buka detail
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 2: Run typecheck + lint** (same pass as Task 3 Step 2 if committing together)

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Expected: clean for touched files.

- [ ] **Step 3: Commit** — skip if merged with Task 3 Step 3

---

### Task 5: Manual verification (no E2E required by spec)

- [ ] **Step 1: Local smoke**

With `pnpm dev`, open a registration **with** partner and **without** conflict; confirm card shows pengurus + partner.

Create or use two registrations in same event sharing a `memberNumber` on tickets; confirm warning + link works.

- [ ] **Step 2: Final commit** (only if doc tweak needed)

No code — optional `git commit --allow-empty -m "chore: verify admin ticket context manually"` is **not** required.

---

## Spec coverage (self-review)

| Spec section | Task |
|--------------|------|
| §4.1 Partner summary | Task 1 `partnerSummaryFromTickets` + Task 4 UI |
| §4.2 Pengurus directory | Task 2 loader + Task 4 three states |
| §4.3 Conflicts, all statuses, links | Task 2 query (no status filter) + Task 4 |
| §4.4 Failure | Task 3 `try/catch` |
| §7 Approve unchanged | No edits to `verify-registration.ts` |
| §6 Unit tests | Task 1 |

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-admin-registration-ticket-context.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — run tasks in this session with executing-plans, batch execution with checkpoints.

**Which approach do you want?**
