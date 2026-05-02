# Delete Member, Event, Admin (Owner Only) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hard-delete capabilities for MasterMember, Event, and AdminProfile records, gated behind the Owner role.

**Architecture:** Three independent server actions — one per entity — all guarded with `guardOwner()`. Each action validates preconditions before deleting (FK Restrict constraints are pre-checked at the application layer for clear user-facing errors). UI components are added where each entity is already managed: AdminProfile in `/admin/settings/committee`, Event in `/admin/events/[eventId]/edit`, MasterMember in the edit dialog at `/admin/members`.

**Tech Stack:** Next.js App Router, Prisma (Neon adapter), Better Auth, @vercel/blob, Vitest, @base-ui/react Dialog, shadcn/ui Button (destructive variant)

---

## File Structure

### New files
- `src/components/admin/event-delete-panel.tsx` — client component: danger-zone section + dialog for deleting an event

### Modified files
- `src/lib/audit/club-audit-actions.ts` — add 3 new audit action constants
- `src/lib/forms/committee-admin-profiles-schema.ts` — add `deleteCommitteeAdminSchema`
- `src/lib/forms/admin-master-member-schema.ts` — add `deleteMasterMemberSchema`
- `src/lib/actions/admin-committee-profiles.ts` — add `deleteCommitteeAdmin()` server action
- `src/lib/actions/admin-committee-profiles.test.ts` — tests for new action
- `src/lib/actions/admin-events.ts` — add `deleteAdminEvent()` server action
- `src/lib/actions/admin-events.test.ts` — create with tests for new action
- `src/lib/actions/admin-master-members.ts` — add `deleteMasterMember()` server action
- `src/lib/actions/admin-master-members.test.ts` — create with tests for new action
- `src/components/admin/committee-admin-settings-panel.tsx` — add 4th action dialog per row
- `src/app/admin/events/[eventId]/edit/page.tsx` — render EventDeletePanel for Owners
- `src/components/admin/member-form-dialog.tsx` — add delete confirmation in edit mode
- `src/app/admin/members/page.tsx` — pass `isOwner` prop
- `src/components/admin/members-admin-page.tsx` — thread `isOwner` to `MemberFormDialog`

---

## Task 1: Delete Admin — Server Action + Tests

**Files:**
- Modify: `src/lib/audit/club-audit-actions.ts`
- Modify: `src/lib/forms/committee-admin-profiles-schema.ts`
- Modify: `src/lib/actions/admin-committee-profiles.ts`
- Modify: `src/lib/actions/admin-committee-profiles.test.ts`

### Context

`AdminProfile` is the record linking a Better Auth user (`authUserId`) to a role. Deleting it removes admin access while leaving the Better Auth `user` row intact (so the person can still sign in but has no admin profile). The `ClubAuditLog` table has `actorAdminProfileId` with `onDelete: SetNull`, so logs survive with a null actor.

Preconditions enforced before deletion:
1. Cannot delete own profile (actor's `authUserId` === target's `authUserId`)
2. If target is an Owner, at least one other Owner must exist (reuses the existing `roleChangePreservesAtLeastOneOwner` helper with `nextRole: Viewer`)

- [ ] **Step 1: Add audit action constant**

In `src/lib/audit/club-audit-actions.ts`, add `ADMIN_PROFILE_DELETED_UI` to the constant object and also the two constants for the other two features (adding all three at once avoids touching this file three more times):

```typescript
export const CLUB_AUDIT_ACTION = {
  COMMITTEE_PRICING_SAVED: "committee_pricing.saved",
  CLUB_WA_TEMPLATE_SAVED: "club_wa_template.saved",
  CLUB_WA_TEMPLATE_RESET: "club_wa_template.reset",
  CLUB_OPERATIONAL_SAVED: "club_operational.saved",
  CLUB_BRANDING_SAVED: "club_branding.saved",
  NOTIFICATION_PREFS_SAVED: "notification_preferences.saved",
  ADMIN_PROFILE_BOOTSTRAP_UPSERT: "admin_profile.bootstrap_upsert",
  ADMIN_PROFILE_CREATED_UI: "admin_profile.created_ui",
  ADMIN_PROFILE_ROLE_CHANGED: "admin_profile.role_changed",
  ADMIN_PROFILE_MEMBER_LINK_CHANGED: "admin_profile.member_link_changed",
  ADMIN_PROFILE_DELETED_UI: "admin_profile.deleted_ui",
  EVENT_DELETED_UI: "event.deleted_ui",
  MASTER_MEMBER_DELETED_UI: "master_member.deleted_ui",
} as const;
```

- [ ] **Step 2: Add Zod schema**

In `src/lib/forms/committee-admin-profiles-schema.ts`, append at the end:

```typescript
export const deleteCommitteeAdminSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
});
```

- [ ] **Step 3: Add server action**

In `src/lib/actions/admin-committee-profiles.ts`, add these imports at the top (merge with existing imports):

```typescript
import {
  addCommitteeAdminByEmailSchema,
  deleteCommitteeAdminSchema,
  revokeCommitteeAdminAccessSchema,
  updateCommitteeAdminMemberLinkSchema,
  updateCommitteeAdminRoleSchema,
} from "@/lib/forms/committee-admin-profiles-schema";
```

Then append to the file:

```typescript
export async function deleteCommitteeAdmin(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = deleteCommitteeAdminSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, role: true },
  });
  if (!target) return rootError("Profil admin tidak ditemukan.");

  if (target.authUserId === gate.owner.authUserId) {
    return rootError("Tidak bisa menghapus profil sendiri.");
  }

  const ownerIds = await listOwnerAuthUserIds();
  if (
    !roleChangePreservesAtLeastOneOwner({
      ownerAuthUserIds: ownerIds,
      targetAuthUserId: target.authUserId,
      previousRole: target.role,
      nextRole: AdminRole.Viewer,
    })
  ) {
    return rootError(
      "Minimal harus ada satu Owner. Tambahkan Owner lain sebelum menghapus Owner ini.",
    );
  }

  await prisma.adminProfile.delete({ where: { id: target.id } });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_DELETED_UI,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: { targetAuthUserId: target.authUserId },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ deleted: true });
}
```

- [ ] **Step 4: Write failing tests**

In `src/lib/actions/admin-committee-profiles.test.ts`, add these tests inside a new `describe` block (the existing mocks at the top already cover prisma, guardOwner, appendClubAuditLog, and next/cache):

```typescript
import {
  addCommitteeAdminByEmail,
  deleteCommitteeAdmin,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";
```

Add at the end of the file:

```typescript
describe("deleteCommitteeAdmin", () => {
  beforeEach(() => {
    vi.mocked(prisma.adminProfile.findMany).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminProfile.delete).mockReset();
  });

  it("returns root error when profile not found", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("adminProfileId", "nonexistent");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toBeTruthy();
  });

  it("blocks deleting own profile", async () => {
    // guardOwner mock returns authUserId: "actor_user" — match it in target
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_self",
      authUserId: "actor_user",
      role: AdminRole.Admin,
    } as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_self");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("sendiri");
  });

  it("blocks deleting sole Owner", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_owner",
      authUserId: "other_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "other_owner" },
    ] as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_owner");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("Owner");
  });

  it("deletes profile when target is non-Owner non-self", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_viewer",
      authUserId: "other_viewer",
      role: AdminRole.Viewer,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "actor_user" },
    ] as never);
    vi.mocked(prisma.adminProfile.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_viewer");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(true);
    expect(vi.mocked(prisma.adminProfile.delete)).toHaveBeenCalledWith({
      where: { id: "p_viewer" },
    });
  });

  it("deletes Owner profile when another Owner exists", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_owner2",
      authUserId: "second_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "actor_user" },
      { authUserId: "second_owner" },
    ] as never);
    vi.mocked(prisma.adminProfile.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_owner2");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(true);
  });
});
```

Also add `delete: vi.fn()` to the `prisma.adminProfile` mock at the top of the file:

```typescript
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    masterMember: { findUnique: vi.fn() },
  },
}));
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/admin-committee-profiles.test.ts
```

Expected: all tests in the file pass (old + new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit/club-audit-actions.ts \
        src/lib/forms/committee-admin-profiles-schema.ts \
        src/lib/actions/admin-committee-profiles.ts \
        src/lib/actions/admin-committee-profiles.test.ts
git commit -m "feat(admin): deleteCommitteeAdmin server action (owner-only)"
```

---

## Task 2: Delete Admin — UI

**Files:**
- Modify: `src/components/admin/committee-admin-settings-panel.tsx`

### Context

`ManageAdminDialogs` is the per-row component in the committee table (around line 77). It already has three dialog/action pairs: role change, member link, revoke access. Add a 4th: delete profile. The dialog shows the target's email and a strong warning that the action is irreversible. Success triggers `props.onAnySuccess()` which bumps `manageKey` in the parent, rerendering all rows.

- [ ] **Step 1: Add useActionState for deleteCommitteeAdmin**

In the imports at the top of `committee-admin-settings-panel.tsx`, import `deleteCommitteeAdmin`:

```typescript
import {
  addCommitteeAdminByEmail,
  deleteCommitteeAdmin,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminMemberLink,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";
```

In `ManageAdminDialogs` (which currently starts around line 77), add a new `useActionState` after the existing three:

```typescript
const [deleteState, deleteDispatch, deletePending] = useActionState(
  deleteCommitteeAdmin,
  null as ActionResult<{ deleted: true }> | null,
);
```

Add an effect that calls `props.onAnySuccess()` on success:

```typescript
useEffect(() => {
  if (deleteState?.ok) props.onAnySuccess();
}, [deleteState?.ok, props.onAnySuccess]);
```

- [ ] **Step 2: Add the delete dialog**

Inside the return `<div>` of `ManageAdminDialogs`, after the existing "Cabut akses" `<Dialog>` block (around line 270), add:

```tsx
<Dialog>
  <DialogTrigger disabled={deletePending} render={<Button variant="destructive" size="sm" />}>
    Hapus
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Hapus profil admin</DialogTitle>
      <DialogDescription>
        Menghapus profil admin untuk <strong>{row.email}</strong> secara permanen.
        Akun masuk tidak dihapus, tetapi semua akses admin dicabut. Tindakan ini tidak bisa dibatalkan.
      </DialogDescription>
    </DialogHeader>
    {deleteState?.ok === false && deleteState.rootError ? (
      <Alert variant="destructive">
        <AlertTitle>Gagal</AlertTitle>
        <AlertDescription>{deleteState.rootError}</AlertDescription>
      </Alert>
    ) : null}
    <form
      action={deleteDispatch}
      key={`d-${props.manageKey}-${row.adminProfileId}`}
    >
      <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={deletePending}>
          {deletePending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Ya, hapus profil"
          )}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/committee-admin-settings-panel.tsx
git commit -m "feat(admin): delete admin profile dialog (owner-only)"
```

---

## Task 3: Delete Event — Server Action + Tests

**Files:**
- Modify: `src/lib/actions/admin-events.ts`
- Create: `src/lib/actions/admin-events.test.ts`

### Context

Events can only be deleted when they have zero registrations (PostgreSQL Restrict FK on `registrations.event_id` would block the DB delete). We precheck and surface a user-friendly error. The event's Vercel Blob cover image (`event.coverBlobUrl`) must be deleted before the DB row — blob deletion is idempotent; a dangling blob is worse than a double-delete attempt.

The existing `admin-events.ts` imports `guardOwnerOrAdmin`. The new delete action requires the stricter `guardOwner`.

- [ ] **Step 1: Import guardOwner and add local requireOwner helper**

In `src/lib/actions/admin-events.ts`, update the guard import:

```typescript
import { guardOwner, guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
```

Then add the local helper function (same pattern as `admin-committee-profiles.ts`) after the existing imports, before the first exported function:

```typescript
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
```

(These two imports may already exist — if not, add them.)

Add helper after imports:

```typescript
async function requireOwner(): Promise<
  ActionResult<never> | { owner: import("@/lib/actions/guard").OwnerGuardContext }
> {
  try {
    const owner = await guardOwner();
    return { owner };
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
}
```

- [ ] **Step 2: Add deleteAdminEvent action**

Append to `src/lib/actions/admin-events.ts`:

```typescript
export async function deleteAdminEvent(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const eventId = formData.get("eventId");
  if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
    return rootError("ID acara tidak valid.");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId.trim() },
    select: {
      id: true,
      title: true,
      coverBlobUrl: true,
      _count: { select: { registrations: true } },
    },
  });
  if (!event) return rootError("Acara tidak ditemukan.");

  if (event._count.registrations > 0) {
    return rootError(
      `Acara tidak bisa dihapus karena memiliki ${event._count.registrations} registrasi.`,
    );
  }

  await del(event.coverBlobUrl).catch(() => undefined);

  await prisma.event.delete({ where: { id: event.id } });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.EVENT_DELETED_UI,
    targetType: "event",
    targetId: event.id,
    metadata: { title: event.title },
  });

  revalidatePath("/admin/events");
  return ok({ deleted: true });
}
```

- [ ] **Step 3: Write failing tests**

Create `src/lib/actions/admin-events.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/guard", () => ({
  guardOwner: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  guardOwnerOrAdmin: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  isAuthError: vi.fn().mockReturnValue(false),
  guardEvent: vi.fn(),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn().mockResolvedValue(undefined),
  put: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stub heavy deps not under test
vi.mock("@/lib/events/generate-event-slug", () => ({
  allocateUniqueEventSlug: vi.fn(),
}));
vi.mock("@/lib/events/event-admin-defaults", () => ({
  resolveCommitteeTicketDefaults: vi.fn(),
}));
vi.mock("@/lib/public/sanitize-event-description", () => ({
  sanitizePublicEventDescriptionHtml: vi.fn((s: string) => s),
}));

import { prisma } from "@/lib/db/prisma";
import { deleteAdminEvent } from "@/lib/actions/admin-events";

describe("deleteAdminEvent", () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset();
    vi.mocked(prisma.event.delete).mockReset();
  });

  it("returns root error when event not found", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("eventId", "nonexistent");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toBeTruthy();
  });

  it("returns root error when event has registrations", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce({
      id: "ev1",
      title: "Test Event",
      coverBlobUrl: "https://blob/cover.webp",
      _count: { registrations: 3 },
    } as never);
    const fd = new FormData();
    fd.set("eventId", "ev1");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("3");
  });

  it("deletes event and blob when no registrations", async () => {
    const { del } = await import("@vercel/blob");
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce({
      id: "ev2",
      title: "Draft Event",
      coverBlobUrl: "https://blob/cover2.webp",
      _count: { registrations: 0 },
    } as never);
    vi.mocked(prisma.event.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("eventId", "ev2");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(true);
    expect(vi.mocked(prisma.event.delete)).toHaveBeenCalledWith({
      where: { id: "ev2" },
    });
    expect(vi.mocked(del)).toHaveBeenCalledWith("https://blob/cover2.webp");
  });

  it("returns field error when eventId is empty", async () => {
    const fd = new FormData();
    fd.set("eventId", "  ");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/admin-events.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/admin-events.ts src/lib/actions/admin-events.test.ts
git commit -m "feat(admin): deleteAdminEvent server action (owner-only)"
```

---

## Task 4: Delete Event — UI

**Files:**
- Create: `src/components/admin/event-delete-panel.tsx`
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`

### Context

The event edit page (`/admin/events/[eventId]/edit`) is a server component that already loads `ctx.role` and `event._count.registrations`. We render a new `EventDeletePanel` client component below the existing `EventAdminForm` — visible only to Owners. The panel shows a warning when registrations > 0 (deletion blocked) and a confirmation dialog when the event is empty.

After successful deletion, the client component navigates to `/admin/events` via `router.push`.

- [ ] **Step 1: Create EventDeletePanel component**

Create `src/components/admin/event-delete-panel.tsx`:

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteAdminEvent } from "@/lib/actions/admin-events";
import type { ActionResult } from "@/lib/forms/action-result";

type Props = {
  eventId: string;
  eventTitle: string;
  registrationCount: number;
};

export function EventDeletePanel({
  eventId,
  eventTitle,
  registrationCount,
}: Props) {
  const router = useRouter();
  const [state, dispatch, isPending] = useActionState(
    deleteAdminEvent,
    null as ActionResult<{ deleted: true }> | null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push("/admin/events");
    }
  }, [state?.ok, router]);

  return (
    <section className="rounded-lg border border-destructive/40 p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-destructive">Zona berbahaya</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tindakan di bawah ini bersifat permanen dan tidak bisa dibatalkan.
        </p>
      </div>

      {registrationCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          Acara tidak bisa dihapus karena memiliki{" "}
          <strong>{registrationCount} registrasi</strong>. Hapus atau batalkan semua
          registrasi terlebih dahulu jika ingin menghapus acara ini.
        </p>
      ) : (
        <Dialog>
          <DialogTrigger
            disabled={isPending}
            render={<Button variant="destructive" className="w-fit" />}
          >
            Hapus acara
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus acara</DialogTitle>
              <DialogDescription>
                Menghapus <strong>{eventTitle}</strong> secara permanen beserta semua
                konfigurasinya. Tindakan ini tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {state?.ok === false && state.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{state.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={dispatch}>
              <input type="hidden" name="eventId" value={eventId} />
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Ya, hapus acara"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Update event edit page to render EventDeletePanel**

In `src/app/admin/events/[eventId]/edit/page.tsx`, add the import:

```typescript
import { EventDeletePanel } from "@/components/admin/event-delete-panel";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";
```

In the return statement, after `<EventAdminForm ... />`, add:

```tsx
{canManageCommitteeAdvancedSettings(ctx.role) ? (
  <EventDeletePanel
    eventId={eventId}
    eventTitle={event.title}
    registrationCount={event._count.registrations}
  />
) : null}
```

- [ ] **Step 3: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/event-delete-panel.tsx \
        src/app/admin/events/[eventId]/edit/page.tsx
git commit -m "feat(admin): delete event UI on edit page (owner-only)"
```

---

## Task 5: Delete Member — Server Action + Tests

**Files:**
- Modify: `src/lib/forms/admin-master-member-schema.ts`
- Modify: `src/lib/actions/admin-master-members.ts`
- Create: `src/lib/actions/admin-master-members.test.ts`

### Context

`MasterMember` deletion is blocked by the DB if:
- The member is `picMasterMemberId` on any `Event` (`onDelete: Restrict`)
- The member owns a `PicBankAccount` (`onDelete: Restrict`)

Other relations are safe:
- `registrations` → `SetNull` (auto-nullifies `Registration.memberId`)
- `adminProfiles` → `SetNull` (auto-nullifies `AdminProfile.memberId`)
- `eventsAsHelper` → `Cascade` (EventPicHelper rows deleted automatically)

Rather than catching the DB error (P2003), we precheck with explicit queries so the error message can name what blocks deletion.

- [ ] **Step 1: Add Zod schema**

In `src/lib/forms/admin-master-member-schema.ts`, append:

```typescript
export const deleteMasterMemberSchema = z.object({
  memberId: z.string().trim().min(1, "ID anggota wajib."),
});
```

- [ ] **Step 2: Add imports and server action**

In `src/lib/actions/admin-master-members.ts`, add at the top:

```typescript
import { guardOwner, guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import type { OwnerGuardContext } from "@/lib/actions/guard";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { deleteMasterMemberSchema } from "@/lib/forms/admin-master-member-schema";
```

(Merge with existing imports — `guardOwnerOrAdmin` may already be imported; add `guardOwner` and `OwnerGuardContext`.)

Add local helper before first exported function:

```typescript
async function requireOwner(): Promise<
  ActionResult<never> | { owner: OwnerGuardContext }
> {
  try {
    const owner = await guardOwner();
    return { owner };
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
}
```

Append the action:

```typescript
export async function deleteMasterMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = deleteMasterMemberSchema.safeParse({
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const member = await prisma.masterMember.findUnique({
    where: { id: parsed.data.memberId },
    select: {
      id: true,
      fullName: true,
      memberNumber: true,
      _count: {
        select: {
          eventsAsPicMaster: true,
          bankAccounts: true,
        },
      },
    },
  });
  if (!member) return rootError("Anggota tidak ditemukan.");

  if (member._count.eventsAsPicMaster > 0) {
    return rootError(
      `Anggota tidak bisa dihapus karena menjadi PIC di ${member._count.eventsAsPicMaster} acara. Ganti PIC acara tersebut terlebih dahulu.`,
    );
  }

  if (member._count.bankAccounts > 0) {
    return rootError(
      `Anggota tidak bisa dihapus karena memiliki ${member._count.bankAccounts} rekening bank terdaftar. Hapus rekening terlebih dahulu.`,
    );
  }

  await prisma.masterMember.delete({ where: { id: member.id } });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.MASTER_MEMBER_DELETED_UI,
    targetType: "master_member",
    targetId: member.id,
    metadata: {
      memberNumber: member.memberNumber,
      fullName: member.fullName,
    },
  });

  revalidatePath("/admin/members");
  return ok({ deleted: true });
}
```

- [ ] **Step 3: Write failing tests**

Create `src/lib/actions/admin-master-members.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    masterMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/guard", () => ({
  guardOwner: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  guardOwnerOrAdmin: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stub CSV parser dependency
vi.mock("papaparse", () => ({ default: { parse: vi.fn() } }));

import { prisma } from "@/lib/db/prisma";
import { deleteMasterMember } from "@/lib/actions/admin-master-members";

describe("deleteMasterMember", () => {
  beforeEach(() => {
    vi.mocked(prisma.masterMember.findUnique).mockReset();
    vi.mocked(prisma.masterMember.delete).mockReset();
  });

  it("returns root error when member not found", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("memberId", "nonexistent");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toBeTruthy();
  });

  it("blocks deletion when member is PIC of events", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce({
      id: "m1",
      fullName: "Budi",
      memberNumber: "001",
      _count: { eventsAsPicMaster: 2, bankAccounts: 0 },
    } as never);
    const fd = new FormData();
    fd.set("memberId", "m1");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("PIC");
  });

  it("blocks deletion when member has bank accounts", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce({
      id: "m2",
      fullName: "Sari",
      memberNumber: "002",
      _count: { eventsAsPicMaster: 0, bankAccounts: 1 },
    } as never);
    const fd = new FormData();
    fd.set("memberId", "m2");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("rekening");
  });

  it("deletes member when no blocking constraints", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce({
      id: "m3",
      fullName: "Andi",
      memberNumber: "003",
      _count: { eventsAsPicMaster: 0, bankAccounts: 0 },
    } as never);
    vi.mocked(prisma.masterMember.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("memberId", "m3");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(true);
    expect(vi.mocked(prisma.masterMember.delete)).toHaveBeenCalledWith({
      where: { id: "m3" },
    });
  });
});
```

- [ ] **Step 4: Run tests**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/admin-master-members.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/admin-master-member-schema.ts \
        src/lib/actions/admin-master-members.ts \
        src/lib/actions/admin-master-members.test.ts
git commit -m "feat(admin): deleteMasterMember server action (owner-only)"
```

---

## Task 6: Delete Member — UI

**Files:**
- Modify: `src/app/admin/members/page.tsx`
- Modify: `src/components/admin/members-admin-page.tsx`
- Modify: `src/components/admin/member-form-dialog.tsx`

### Context

The member edit dialog (`MemberFormDialog`) is opened when the user clicks the pencil icon in the members table. Add a "Hapus anggota" confirmation flow inside the edit dialog, shown only when `isOwner === true`. The flow uses a `confirming` state boolean: first render shows the edit form with a "Hapus anggota" button at the bottom; after clicking, the form is replaced by a confirmation message with [Batal] and [Ya, hapus] buttons.

On successful deletion, the dialog closes and the page refreshes (same as after a successful edit via `onSaved`).

- [ ] **Step 1: Pass isOwner through the page**

In `src/app/admin/members/page.tsx`, update the `MembersAdminPage` render to pass `isOwner`:

```tsx
return (
  <MembersAdminPage
    csvTemplateText={csvTemplateText}
    rows={rows}
    pagination={{ page, pageSize: ADMIN_TABLE_PAGE_SIZE, totalItems }}
    filter={filter}
    searchQuery={q ?? ""}
    tabCounts={counts}
    isOwner={ctx.role === "Owner"}
  />
);
```

- [ ] **Step 2: Thread isOwner through MembersAdminPage to MemberFormDialog**

In `src/components/admin/members-admin-page.tsx`:

Add `isOwner: boolean` to the `Props` type:

```typescript
type Props = {
  rows: AdminMasterMemberRowVm[];
  csvTemplateText: string;
  filter: ActivityFilter;
  searchQuery: string;
  tabCounts: { all: number; active: number; inactive: number };
  pagination: { page: number; pageSize: number; totalItems: number };
  isOwner: boolean;
};
```

Destructure it in the function signature:

```typescript
export function MembersAdminPage({
  rows,
  csvTemplateText,
  filter,
  searchQuery,
  tabCounts,
  pagination,
  isOwner,
}: Props) {
```

Pass it to both `MemberFormDialog` usages in the JSX (create dialog and edit dialog):

```tsx
<MemberFormDialog
  mode="create"
  open={createOpen}
  onOpenChange={setCreateOpen}
  onSaved={refreshRows}
  isOwner={isOwner}
/>
<MemberFormDialog
  mode="edit"
  open={editingMember !== null}
  onOpenChange={(open) => { if (!open) setEditingMember(null); }}
  member={editingMember}
  onSaved={refreshRows}
  isOwner={isOwner}
/>
```

- [ ] **Step 3: Update MemberFormDialog with delete flow**

In `src/components/admin/member-form-dialog.tsx`:

Add new imports:

```typescript
import { useState, useTransition } from "react";  // useState already imported; keep existing
import { deleteMasterMember } from "@/lib/actions/admin-master-members";
```

Add `isOwner: boolean` to `Props`:

```typescript
type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: AdminMasterMemberRowVm | null;
  onSaved: () => void;
  isOwner: boolean;
};
```

Destructure in function signature:

```typescript
export function MemberFormDialog({
  mode,
  open,
  onOpenChange,
  member,
  onSaved,
  isOwner,
}: Props) {
```

Inside the function body, add state for the confirmation flow:

```typescript
const [confirming, setConfirming] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);
const [isDeleting, startDeleteTransition] = useTransition();
```

Reset confirming state when dialog closes:

```typescript
// Add to the existing useEffect that resets form on open change, or add a new one:
useEffect(() => {
  if (!open) {
    setConfirming(false);
    setDeleteError(null);
  }
}, [open]);
```

Add the delete handler:

```typescript
function handleDelete() {
  if (!member) return;
  startDeleteTransition(async () => {
    const fd = new FormData();
    fd.set("memberId", member.id);
    const result = await deleteMasterMember(undefined, fd);
    if (result.ok) {
      onOpenChange(false);
      onSaved();
    } else {
      setDeleteError(result.rootError ?? "Gagal menghapus anggota.");
    }
  });
}
```

In the JSX, at the bottom of the DialogContent (after the save button in the edit form footer), add the danger zone section. The pattern is: show it only in edit mode + isOwner:

```tsx
{mode === "edit" && isOwner ? (
  confirming ? (
    <div className="flex flex-col gap-3 border-t pt-4 mt-2">
      <p className="text-sm text-destructive font-medium">
        Hapus <strong>{member?.fullName}</strong> secara permanen? Tindakan ini tidak bisa dibatalkan.
      </p>
      {deleteError ? (
        <p className="text-sm text-destructive">{deleteError}</p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDeleting}
          onClick={() => { setConfirming(false); setDeleteError(null); }}
        >
          Batal
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Ya, hapus anggota"}
        </Button>
      </div>
    </div>
  ) : (
    <div className="border-t pt-4 mt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        Hapus anggota…
      </Button>
    </div>
  )
) : null}
```

Also add the Loader2 import if not already present:

```typescript
import { Loader2 } from "lucide-react";
```

- [ ] **Step 4: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 5: Run full test suite**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/members/page.tsx \
        src/components/admin/members-admin-page.tsx \
        src/components/admin/member-form-dialog.tsx
git commit -m "feat(admin): delete member UI in edit dialog (owner-only)"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Delete AdminProfile (owner only) | Tasks 1–2 |
| Delete Event (owner only) | Tasks 3–4 |
| Delete MasterMember (owner only) | Tasks 5–6 |
| Cannot delete last Owner | Task 1, step 3 (roleChangePreservesAtLeastOneOwner check) |
| Cannot delete self | Task 1, step 3 (authUserId comparison) |
| Blob cleanup on event delete | Task 3, step 2 (del() call before DB delete) |
| Block event delete with registrations | Task 3, step 2 (precheck) |
| Block member delete when PIC of event | Task 5, step 2 (precheck eventsAsPicMaster) |
| Block member delete when has bank accounts | Task 5, step 2 (precheck bankAccounts) |
| Audit logging for all three | Tasks 1, 3, 5 (appendClubAuditLog) |
| UI gated to Owner role | Tasks 2, 4, 6 (canManageCommitteeAdvancedSettings / isOwner prop) |

### No placeholders — all steps contain complete code.

### Type consistency check
- `deleteCommitteeAdmin` returns `ActionResult<{ deleted: true }>` ✓ (matches useActionState type in Task 2)
- `deleteAdminEvent` returns `ActionResult<{ deleted: true }>` ✓ (matches EventDeletePanel useActionState)
- `deleteMasterMember` returns `ActionResult<{ deleted: true }>` ✓ (matches handleDelete in Task 6)
- `requireOwner()` helper: same signature in all three action files ✓
- `CLUB_AUDIT_ACTION.ADMIN_PROFILE_DELETED_UI` added in Task 1 step 1, referenced in Task 1 step 3 ✓
- `CLUB_AUDIT_ACTION.EVENT_DELETED_UI` added in Task 1 step 1, referenced in Task 3 step 2 ✓
- `CLUB_AUDIT_ACTION.MASTER_MEMBER_DELETED_UI` added in Task 1 step 1, referenced in Task 5 step 2 ✓
