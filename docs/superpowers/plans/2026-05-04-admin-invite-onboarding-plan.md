# Admin invite & onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner membuat undangan admin (**email + peran**); penerima menyelesaikan onboarding lewat **URL token sekali pakai**; sistem membuat **`User` (Better Auth)** + **`AdminProfile`** dan menandai undangan terpakai, dengan audit dan UI daftar undangan di halaman komite.

**Architecture:** Model **`AdminInvitation`** menyimpan **`tokenHash`** (SHA-256 dari token raw), TTL 7 hari, FK pembuat Owner. Aksi Owner (`guardOwner`) membuat/mencabut undangan; **`auth.api.signUpEmail`** (pola `scripts/bootstrap-admin.ts`) membuat kredensial; transaksi Prisma **membuat `AdminProfile` + mengisi `consumedAt`**. Email undangan lewat **`sendTransactionalEmail`** jika Resend terpasang; selain itu response action mengembalikan **`inviteUrl`** untuk disalin. Halaman publik **`/(auth)/admin/invite/[token]`** memvalidasi token di server lalu form klien memanggil server action **terima**.

**Tech Stack:** Next.js App Router, Prisma, Better Auth (`auth.api`), Vitest, React Email (pola existing), zod, react-hook-form.

**Rujukan spesifikasi:** [`docs/superpowers/specs/2026-05-04-admin-invite-onboarding-design.md`](../specs/2026-05-04-admin-invite-onboarding-design.md)

---

## File map

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Model `AdminInvitation` + relasi `AdminProfile.invitationsCreated`. |
| `src/lib/admin/admin-invite-constants.ts` | TTL ms, label peran undangan. |
| `src/lib/admin/admin-invite-crypto.ts` | `generateAdminInviteToken()`, `hashAdminInviteToken(raw)`. |
| `src/lib/admin/admin-invite-email.ts` | `normalizeAdminInvitationEmail`. |
| `src/lib/admin/admin-invite-crypto.test.ts` | Tes hash/token. |
| `src/lib/admin/admin-invite-email.test.ts` | Tes normalisasi. |
| `src/lib/audit/club-audit-actions.ts` | `ADMIN_INVITATION_*` |
| `src/lib/forms/admin-invitation-schema.ts` | zod buat / terima / cabut. |
| `src/lib/actions/admin-admin-invitations.ts` | `createAdminInvitation`, `revokeAdminInvitation` (Owner). |
| `src/lib/actions/accept-admin-invitation.ts` | `acceptAdminInvitation` (publik + token). |
| `src/lib/actions/admin-admin-invitations.test.ts` | Mock Prisma + guard Owner. |
| `src/lib/auth/emails/admin-invite-email.tsx` | React Email undangan. |
| `src/lib/auth/emails/render-emails.ts` | `renderAdminInviteEmail`. |
| `src/app/(auth)/admin/invite/[token]/page.tsx` | RSC: validasi token, metadata `noindex`. |
| `src/components/admin/admin-invite-accept-form.tsx` | Form onboarding (nama + sandi). |
| `src/lib/admin/load-pending-admin-invitations.ts` | Query undangan belum habis (termasuk kedaluwarsa) untuk komite. |
| `src/app/admin/settings/committee/page.tsx` | Muat undangan + oper `CommitteeAdminSettingsPanel`. |
| `src/components/admin/committee-admin-settings-panel.tsx` | Dialog undang, tabel undangan, salin URL. |
| `CLAUDE.md` | Satu kalimat alur undangan. |

---

### Task 1: Skema Prisma `AdminInvitation`

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `pnpm prisma migrate dev --name admin_invitations` (atau nama setara)

- [ ] **Step 1: Tambah model dan relasi pada `AdminProfile`**

Di `prisma/schema.prisma`, pada model `AdminProfile`, tambahkan field relasi:

```prisma
  invitationsCreated AdminInvitation[] @relation("AdminInvitationCreator")
```

Tambahkan model baru **setelah** `AdminProfile` (atah sebelum `User` agar mudah dicari):

```prisma
/// Undangan Owner → admin baru; token disimpan sebagai hash (bukan plaintext).
model AdminInvitation {
  id       String @id @default(cuid())
  /// Email normalisasi lowercase + trim.
  emailNormalized String
  role            AdminRole
  /// SHA-256 hex dari token raw (lihat `hashAdminInviteToken`).
  tokenHash String @unique

  expiresAt DateTime
  createdAt DateTime @default(now())

  createdByAdminProfileId String
  createdBy               AdminProfile @relation("AdminInvitationCreator", fields: [createdByAdminProfileId], references: [id], onDelete: Restrict)

  consumedAt DateTime?
  revokedAt  DateTime?

  @@index([emailNormalized])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Migrasi**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "$(git rev-parse --show-toplevel)" && nvm use && pnpm prisma migrate dev --name admin_invitations
```

Expected: migrasi terbuat, `prisma generate` sukses.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): AdminInvitation for owner-provisioned admin onboarding"
```

---

### Task 2: Konstanta + kripto + normalisasi email + tes

**Files:**
- Create: `src/lib/admin/admin-invite-constants.ts`
- Create: `src/lib/admin/admin-invite-crypto.ts`
- Create: `src/lib/admin/admin-invite-email.ts`
- Create: `src/lib/admin/admin-invite-crypto.test.ts`
- Create: `src/lib/admin/admin-invite-email.test.ts`

- [ ] **Step 1: Konstanta**

Create `src/lib/admin/admin-invite-constants.ts`:

```typescript
/** TTL undangan admin (7 hari), milidetik. */
export const ADMIN_INVITE_TTL_MS = 168 * 60 * 60 * 1000;
```

- [ ] **Step 2: Kripto**

Create `src/lib/admin/admin-invite-crypto.ts`:

```typescript
import { createHash, randomBytes } from "node:crypto";

export type GeneratedAdminInviteToken = {
  /** Hanya ditampilkan sekali kepada Owner atau di email — jangan simpan di DB. */
  rawToken: string;
  /** Disimpan di kolom `AdminInvitation.tokenHash`. */
  tokenHash: string;
};

export function hashAdminInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Token URL-safe (~43 char base64url untuk 32 byte). */
export function generateAdminInviteToken(): GeneratedAdminInviteToken {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashAdminInviteToken(rawToken) };
}
```

- [ ] **Step 3: Email**

Create `src/lib/admin/admin-invite-email.ts`:

```typescript
export function normalizeAdminInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

- [ ] **Step 4: Tes**

Create `src/lib/admin/admin-invite-crypto.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { generateAdminInviteToken, hashAdminInviteToken } from "./admin-invite-crypto";

describe("hashAdminInviteToken", () => {
  it("is deterministic hex", () => {
    expect(hashAdminInviteToken("abc")).toBe(hashAdminInviteToken("abc"));
    expect(hashAdminInviteToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("generateAdminInviteToken", () => {
  it("returns raw + matching hash", () => {
    const a = generateAdminInviteToken();
    expect(a.rawToken.length).toBeGreaterThan(30);
    expect(hashAdminInviteToken(a.rawToken)).toBe(a.tokenHash);
  });

  it("generates differing tokens", () => {
    const a = generateAdminInviteToken();
    const b = generateAdminInviteToken();
    expect(a.rawToken).not.toBe(b.rawToken);
  });
});
```

Create `src/lib/admin/admin-invite-email.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { normalizeAdminInvitationEmail } from "./admin-invite-email";

describe("normalizeAdminInvitationEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeAdminInvitationEmail("  A@B.COM ")).toBe("a@b.com");
  });
});
```

- [ ] **Step 5: Jalankan tes**

```bash
pnpm vitest run src/lib/admin/admin-invite-crypto.test.ts src/lib/admin/admin-invite-email.test.ts
```

Expected: semua **PASS**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/admin-invite-constants.ts src/lib/admin/admin-invite-crypto.ts src/lib/admin/admin-invite-email.ts src/lib/admin/admin-invite-crypto.test.ts src/lib/admin/admin-invite-email.test.ts
git commit -m "feat(admin): invite token helpers and email normalization"
```

---

### Task 3: Konstanta audit

**Files:**
- Modify: `src/lib/audit/club-audit-actions.ts`

- [ ] **Step 1: Tambahkan tiga aksi**

Dalam objek `CLUB_AUDIT_ACTION`, tambahkan (alfabet atau dekat admin_profile):

```typescript
  ADMIN_INVITATION_CONSUMED: "admin_invitation.consumed",
  ADMIN_INVITATION_CREATED: "admin_invitation.created",
  ADMIN_INVITATION_REVOKED: "admin_invitation.revoked",
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/audit/club-audit-actions.ts
git commit -m "feat(audit): actions for admin invitations"
```

---

### Task 4: Skema zod

**Files:**
- Create: `src/lib/forms/admin-invitation-schema.ts`

Create `src/lib/forms/admin-invitation-schema.ts`:

```typescript
import { z } from "zod";

import { AdminRole } from "@prisma/client";

/** Peran yang boleh di-assign lewat undangan (bukan Owner). */
export const adminInvitableRoleSchema = z.enum([
  AdminRole.Admin,
  AdminRole.Verifier,
  AdminRole.Viewer,
]);

export const createAdminInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid.")
    .transform((s) => s.toLowerCase()),
  role: adminInvitableRoleSchema,
});

export const revokeAdminInvitationSchema = z.object({
  invitationId: z.string().trim().min(1, "Undangan tidak valid."),
});

export const acceptAdminInvitationSchema = z.object({
  token: z.string().trim().min(1, "Taut tidak valid."),
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(120, "Nama terlalu panjang."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/forms/admin-invitation-schema.ts
git commit -m "feat(forms): zod schemas for admin invitations"
```

---

### Task 5: Pembangun URL + email React

**Files:**
- Create: `src/lib/auth/emails/admin-invite-email.tsx`
- Modify: `src/lib/auth/emails/render-emails.ts`
- Create helper bawaan: bisa inline di Task 6 — untuk DRY tambahkan `src/lib/admin/build-admin-invite-url.ts`:

Create `src/lib/admin/build-admin-invite-url.ts`:

```typescript
/**
 * Origin aplikasi untuk taut undangan. Sama pola dengan magic link (`BETTER_AUTH_URL`).
 */
export function buildAdminInviteAcceptUrl(rawToken: string): string {
  const base = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error(
      "BETTER_AUTH_URL belum diatur — diperlukan untuk membangun taut undangan.",
    );
  }
  // Token pakai base64url — aman sebagai satu segmen path; jangan tambah pengodean ganda.
  return `${base}/admin/invite/${rawToken}`;
}
```

Create `src/lib/auth/emails/admin-invite-email.tsx` (ringkas seperti magic link):

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

export function AdminInviteEmail(props: {
  inviteUrl: string;
  /** Peran sebagai teks pendek untuk email. */
  roleLabel: string;
}) {
  return (
    <Html lang="id">
      <Head />
      <Preview>Undangan admin Match Screening</Preview>
      <Body
        style={{
          backgroundColor: "#f9fafb",
          fontFamily: "sans-serif",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
          }}
        >
          <Text style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 12px" }}>
            Undangan admin
          </Text>
          <Text style={{ fontSize: "14px", color: "#52525b", margin: "0 0 16px" }}>
            Anda diundang sebagai <strong>{props.roleLabel}</strong>. Selesaikan pengaturan
            kata sandi dan nama pada taut berikut (berlaku terbatas, satu kali pakai).
          </Text>
          <Section style={{ textAlign: "center", marginTop: "24px" }}>
            <Button
              href={props.inviteUrl}
              style={{
                backgroundColor: "#18181b",
                borderRadius: "6px",
                color: "#fff",
                padding: "12px 20px",
                fontWeight: "600",
              }}
            >
              Terima undangan
            </Button>
          </Section>
          <Text
            style={{
              fontSize: "12px",
              color: "#a1a1aa",
              marginTop: "24px",
              wordBreak: "break-all",
            }}
          >
            Atau salin taut: {props.inviteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

Di `src/lib/auth/emails/render-emails.ts` tambahkan:

```typescript
import { AdminInviteEmail } from "./admin-invite-email";
// ...

export const renderAdminInviteEmail = (
  inviteUrl: string,
  roleLabel: string,
): Promise<string> =>
  render(createElement(AdminInviteEmail, { inviteUrl, roleLabel }));
```

- [ ] **Commit**

```bash
git add src/lib/admin/build-admin-invite-url.ts src/lib/auth/emails/admin-invite-email.tsx src/lib/auth/emails/render-emails.ts
git commit -m "feat(email): React Email template and invite URL helper"
```

---

### Task 6: Server actions Owner — buat & cabut undangan

**Files:**
- Create: `src/lib/actions/admin-admin-invitations.ts`

Implementasi lengkap berikut (paste sebagai isi berkas baru `"use server"`):

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { ADMIN_INVITE_TTL_MS } from "@/lib/admin/admin-invite-constants";
import { generateAdminInviteToken } from "@/lib/admin/admin-invite-crypto";
import { buildAdminInviteAcceptUrl } from "@/lib/admin/build-admin-invite-url";
import { normalizeAdminInvitationEmail } from "@/lib/admin/admin-invite-email";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  guardOwner,
  isAuthError,
  type OwnerGuardContext,
} from "@/lib/actions/guard";
import {
  createAdminInvitationSchema,
  revokeAdminInvitationSchema,
} from "@/lib/forms/admin-invitation-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { prisma } from "@/lib/db/prisma";
import { renderAdminInviteEmail } from "@/lib/auth/emails/render-emails";
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
import { sendTransactionalEmail } from "@/lib/auth/send-transactional-email";

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

const ROLE_LABEL_EMAIL: Record<string, string> = {
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

export type CreateAdminInvitationResult = {
  created: true;
  /** Ada jika email tidak dikirim atau gagal dikirim — untuk disalin oleh Owner. */
  inviteUrl?: string;
};

export async function createAdminInvitation(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<CreateAdminInvitationResult>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = createAdminInvitationSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const email = normalizeAdminInvitationEmail(parsed.data.email);

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    const profile = await prisma.adminProfile.findUnique({
      where: { authUserId: existingUser.id },
      select: { id: true },
    });
    if (profile) {
      return rootError("Email ini sudah terdaftar sebagai admin.");
    }
    return rootError(
      "Email ini sudah punya akun pengguna. Gunakan Tautkan admin (email sudah ada), bukan undangan.",
    );
  }

  const now = Date.now();
  const activeInvite = await prisma.adminInvitation.findFirst({
    where: {
      emailNormalized: email,
      consumedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date(now) },
    },
    select: { id: true },
  });
  if (activeInvite) {
    return rootError(
      "Sudah ada undangan aktif untuk email ini — batalkan dulu atau tunggu kedaluwarsa.",
    );
  }

  const { rawToken, tokenHash } = generateAdminInviteToken();
  const expiresAt = new Date(now + ADMIN_INVITE_TTL_MS);

  const created = await prisma.adminInvitation.create({
    data: {
      emailNormalized: email,
      role: parsed.data.role,
      tokenHash,
      expiresAt,
      createdByAdminProfileId: gate.owner.profileId,
    },
    select: { id: true },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_INVITATION_CREATED,
    targetType: "admin_invitation",
    targetId: created.id,
    metadata: { email, role: parsed.data.role },
  });

  let inviteUrl: string | undefined;
  try {
    inviteUrl = buildAdminInviteAcceptUrl(rawToken);
  } catch {
    inviteUrl = undefined;
  }

  if (inviteUrl && isTransactionalEmailConfigured()) {
    try {
      const html = await renderAdminInviteEmail(
        inviteUrl,
        ROLE_LABEL_EMAIL[parsed.data.role] ?? parsed.data.role,
      );
      await sendTransactionalEmail({
        to: email,
        subject: "Undangan admin Match Screening",
        text:
          `Anda diundang sebagai ${ROLE_LABEL_EMAIL[parsed.data.role] ?? parsed.data.role}. ` +
          `Buka taut berikut untuk menyelesaikan pengaturan akun (terbatas, satu kali):\n\n${inviteUrl}`,
        html,
      });
      revalidatePath("/admin/settings/committee");
      return ok({ created: true });
    } catch (e) {
      console.error("[createAdminInvitation] email failed", e);
      revalidatePath("/admin/settings/committee");
      return ok({ created: true, inviteUrl });
    }
  }

  revalidatePath("/admin/settings/committee");
  return ok({
    created: true,
    inviteUrl: inviteUrl ?? undefined,
  });
}

export async function revokeAdminInvitation(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ revoked: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = revokeAdminInvitationSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const row = await prisma.adminInvitation.findUnique({
    where: { id: parsed.data.invitationId },
    select: {
      id: true,
      emailNormalized: true,
      consumedAt: true,
      revokedAt: true,
    },
  });
  if (!row) return rootError("Undangan tidak ditemukan.");
  if (row.consumedAt) return rootError("Undangan ini sudah dipakai.");
  if (row.revokedAt) return rootError("Undangan ini sudah dibatalkan.");

  await prisma.adminInvitation.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_INVITATION_REVOKED,
    targetType: "admin_invitation",
    targetId: row.id,
    metadata: { email: row.emailNormalized },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ revoked: true });
}
```

- [ ] **Tes Vitest Owner**

Create `src/lib/actions/admin-admin-invitations.test.ts` (isi penuh):

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

import { AdminRole } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    adminProfile: { findUnique: vi.fn() },
    adminInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/send-transactional-email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/emails/render-emails", () => ({
  renderAdminInviteEmail: vi.fn().mockResolvedValue("<p>x</p>"),
}));

vi.mock("@/lib/auth/transactional-email-config", () => ({
  isTransactionalEmailConfigured: vi.fn(() => false),
}));

vi.mock("@/lib/admin/build-admin-invite-url", () => ({
  buildAdminInviteAcceptUrl: vi.fn(() => "http://localhost:3000/admin/invite/RAW"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import {
  createAdminInvitation,
  revokeAdminInvitation,
} from "@/lib/actions/admin-admin-invitations";

describe("createAdminInvitation", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminInvitation.findFirst).mockReset();
    vi.mocked(prisma.adminInvitation.create).mockReset();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.adminInvitation.create).mockResolvedValue({
      id: "inv_new",
    } as never);
  });

  it("rejects when user exists without admin profile (tautkan path)", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: "u1" } as never);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.set("email", "x@example.com");
    fd.set("role", AdminRole.Verifier);
    const r = await createAdminInvitation(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError ?? "").toContain("Tautkan admin");
    expect(prisma.adminInvitation.create).not.toHaveBeenCalled();
  });

  it("rejects when an active invitation already exists", async () => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValueOnce({
      id: "existing",
    } as never);

    const fd = new FormData();
    fd.set("email", "new@example.com");
    fd.set("role", AdminRole.Viewer);
    const r = await createAdminInvitation(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError ?? "").toContain("undangan aktif");
    expect(prisma.adminInvitation.create).not.toHaveBeenCalled();
  });

  it("creates invitation when checks pass", async () => {
    const fd = new FormData();
    fd.set("email", "fresh@example.com");
    fd.set("role", AdminRole.Admin);
    const r = await createAdminInvitation(undefined, fd);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.created).toBe(true);
    expect(vi.mocked(prisma.adminInvitation.create)).toHaveBeenCalled();
  });
});

describe("revokeAdminInvitation", () => {
  beforeEach(() => {
    vi.mocked(prisma.adminInvitation.findUnique).mockReset();
    vi.mocked(prisma.adminInvitation.update).mockReset();
  });

  it("blocks when consumed", async () => {
    vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValueOnce({
      id: "inv1",
      emailNormalized: "a@b.com",
      consumedAt: new Date(),
      revokedAt: null,
    } as never);

    const fd = new FormData();
    fd.set("invitationId", "inv1");
    const r = await revokeAdminInvitation(undefined, fd);
    expect(r.ok).toBe(false);
    expect(prisma.adminInvitation.update).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm vitest run src/lib/actions/admin-admin-invitations.test.ts` — Expected: **PASS**.

- [ ] **Commit**

```bash
git add src/lib/actions/admin-admin-invitations.ts src/lib/actions/admin-admin-invitations.test.ts
git commit -m "feat(admin): Owner create/revoke admin invitations"
```

---

### Task 7: Server action terima undangan (publik)

**Files:**
- Create: `src/lib/actions/accept-admin-invitation.ts`

```typescript
"use server";

import { auth } from "@/lib/auth/auth";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { acceptAdminInvitationSchema } from "@/lib/forms/admin-invitation-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { prisma } from "@/lib/db/prisma";
import { hashAdminInviteToken } from "@/lib/admin/admin-invite-crypto";
import { normalizeAdminInvitationEmail } from "@/lib/admin/admin-invite-email";

/** Setelah sukses, pengguna mengarah ke halaman masuk admin. */
export async function acceptAdminInvitation(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = acceptAdminInvitationSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const tokenHash = hashAdminInviteToken(parsed.data.token);

  const invite = await prisma.adminInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      emailNormalized: true,
      role: true,
      expiresAt: true,
      consumedAt: true,
      revokedAt: true,
    },
  });

  if (!invite || invite.revokedAt) {
    return rootError("Taut tidak valid atau undangan dibatalkan.");
  }
  if (invite.consumedAt) {
    return rootError("Undangan ini sudah dipakai. Masuk dengan akun Anda.");
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return rootError("Undangan sudah kedaluwarsa. Minta Owner mengirim undangan baru.");
  }

  const email = normalizeAdminInvitationEmail(invite.emailNormalized);

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    return rootError(
      "Akun dengan email ini sudah ada. Hubungi Owner — jangan gunakan formulir ini.",
    );
  }

  let authUserId: string;
  try {
    const data = await auth.api.signUpEmail({
      body: {
        email,
        password: parsed.data.password,
        name: parsed.data.name,
      },
    });
    authUserId = data.user?.id ?? "";
  } catch (e: unknown) {
    console.error("[acceptAdminInvitation] signUpEmail", e);
    return rootError(
      "Tidak bisa membuat akun saat ini. Coba lagi atau hubungi Owner.",
    );
  }
  if (!authUserId) {
    return rootError("Registrasi gagal tanpa penjelasan dari server.");
  }

  try {
    const profile = await prisma.adminProfile.create({
      data: { authUserId, role: invite.role },
      select: { id: true },
    });

    await prisma.adminInvitation.update({
      where: { id: invite.id },
      data: { consumedAt: new Date() },
    });

    await appendClubAuditLog(prisma, {
      actorProfileId: profile.id,
      actorAuthUserId: authUserId,
      action: CLUB_AUDIT_ACTION.ADMIN_INVITATION_CONSUMED,
      targetType: "admin_invitation",
      targetId: invite.id,
      metadata: { email, role: invite.role },
    });

    return ok({ redirectTo: "/admin/sign-in" });
  } catch (e) {
    console.error("[acceptAdminInvitation] profile/invite finalize", e);
    return rootError(
      "Akun auth terbentuk tetapi profil admin gagal disimpan — hubungi Owner.",
    );
  }
}
```

**Catatan:** Tipe kembalian `signUpEmail` bisa berbeda per versi Better Auth — sesuaikan (`data?.user?.id`) jika `tsc` mengeluh dengan mengikuti pola `scripts/bootstrap-admin.ts`.

- [ ] **Commit**

```bash
git add src/lib/actions/accept-admin-invitation.ts
git commit -m "feat(admin): accept invitation via signUp and AdminProfile create"
```

---

### Task 8: Halaman undangan & form klien

**Files:**
- Create: `src/app/(auth)/admin/invite/[token]/page.tsx`
- Create: `src/components/admin/admin-invite-accept-form.tsx`

`page.tsx` (RSC):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminInviteAcceptForm } from "@/components/admin/admin-invite-accept-form";
import { hashAdminInviteToken } from "@/lib/admin/admin-invite-crypto";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Undangan admin",
  robots: "noindex, nofollow",
};

export default async function AdminInviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const raw = decodeURIComponent(token).trim();
  if (!raw) notFound();

  const tokenHash = hashAdminInviteToken(raw);
  const invite = await prisma.adminInvitation.findUnique({
    where: { tokenHash },
    select: { emailNormalized: true, expiresAt: true, consumedAt: true, revokedAt: true },
  });

  if (!invite || invite.revokedAt || invite.consumedAt) notFound();

  const expired = invite.expiresAt.getTime() <= Date.now();
  if (expired) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight">Undangan kedaluwarsa</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Minta Owner mengirim undangan baru dari Pengaturan → Komite & admin.
        </p>
        <Link href="/admin/sign-in" className="text-primary mt-6 underline">
          Menuju masuk admin
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Selesaikan undangan admin</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Untuk{" "}
        <span className="text-foreground font-medium">{invite.emailNormalized}</span>
      </p>
      <AdminInviteAcceptForm token={raw} />
    </main>
  );
}
```

`admin-invite-accept-form.tsx` — pola `useActionState` + redirect `useRouter`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { acceptAdminInvitation } from "@/lib/actions/accept-admin-invitation";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/forms/action-result";

export function AdminInviteAcceptForm(props: { token: string }) {
  const router = useRouter();
  const bumped = useRef(false);
  const [state, dispatch, pending] = useActionState(
    acceptAdminInvitation,
    null as ActionResult<{ redirectTo: string }> | null,
  );

  useEffect(() => {
    if (!state?.ok || bumped.current) return;
    bumped.current = true;
    router.push(state.data.redirectTo);
  }, [state, router]);

  return (
    <form action={dispatch} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={props.token} />
      {state?.ok === false && state.rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{state.rootError}</AlertDescription>
        </Alert>
      ) : null}
      <Field>
        <FieldLabel htmlFor="invite-name">Nama tampilan</FieldLabel>
        <Input
          id="invite-name"
          name="name"
          autoComplete="name"
          required
          disabled={pending}
          maxLength={120}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="invite-password">Kata sandi</FieldLabel>
        <Input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
        <p className="text-muted-foreground mt-1 text-xs">Minimal 8 karakter.</p>
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Buat akun admin"}
      </Button>
    </form>
  );
}
```

Sesuaikan impor `@/components/ui/field` jika proyek memakai varian nama berbeda (ikuti pola form komite lain).

- [ ] **Commit**

```bash
git add src/app/\(auth\)/admin/invite/\[token\]/page.tsx src/components/admin/admin-invite-accept-form.tsx
git commit -m "feat(admin): public invite acceptance page and form"
```

---

### Task 9: Loader undangan + UI komite

**Files:**
- Create: `src/lib/admin/load-pending-admin-invitations.ts`
- Modify: `src/app/admin/settings/committee/page.tsx`
- Modify: `src/components/admin/committee-admin-settings-panel.tsx`

Create `src/lib/admin/load-pending-admin-invitations.ts`:

```typescript
import { prisma } from "@/lib/db/prisma";

export type PendingAdminInvitationRowVm = {
  id: string;
  emailNormalized: string;
  role: string;
  expiresAtIso: string;
  createdAtIso: string;
};

export async function loadPendingAdminInvitationsForCommittee(): Promise<
  PendingAdminInvitationRowVm[]
> {
  const rows = await prisma.adminInvitation.findMany({
    where: { consumedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      emailNormalized: true,
      role: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    emailNormalized: r.emailNormalized,
    role: r.role,
    expiresAtIso: r.expiresAt.toISOString(),
    createdAtIso: r.createdAt.toISOString(),
  }));
}
```

Di `committee/page.tsx`, paralel dengan `loadCommitteeAdminDirectory()`:

```typescript
import { loadPendingAdminInvitationsForCommittee } from "@/lib/admin/load-pending-admin-invitations";

const [directory, pendingInvitations] = await Promise.all([
  loadCommitteeAdminDirectory(),
  loadPendingAdminInvitationsForCommittee(),
]);

// pass pendingInvitations to CommitteeAdminSettingsPanel
```

Pada `committee-admin-settings-panel.tsx`:

1. Props baru: `pendingInvitations: PendingAdminInvitationRowVm[]`.
2. Impor `createAdminInvitation`, `revokeAdminInvitation`; state untuk dialog **Undang admin** dengan field email + `<select>` peran (`Admin`|`Verifier`|`Viewer`).
3. `useEffect` seperti dialog tambah admin: kalau `createState?.ok`, jika `data.inviteUrl` munculkan `toast` atau `navigator.clipboard` + `Alert` sekali pakai (**URL rahasia**) — pola `toastCudSuccess` / `prompt` dokumentasi QA jika clipboard gagal.
4. Sub-bagian **Undangan tertunda**: tabel `emailNormalized`, `role`, `expiresAt` (format `id-ID`), form **Batalkan** → `revokeAdminInvitation`.

- [ ] **Commit**

```bash
git add src/lib/admin/load-pending-admin-invitations.ts src/app/admin/settings/committee/page.tsx src/components/admin/committee-admin-settings-panel.tsx
git commit -m "feat(admin): committee UI for invitations and revoke"
```

---

### Task 10: Dokumentasi CLI + gate build

**Files:**
- Modify: `CLAUDE.md`

Tambahkan satu kalimat pada bagian arsitektur/route admin atau perintah, mis.:

```markdown
- **Undangan admin (Owner)** — Pemilik dapat mengundang **email + peran** dari **Pengaturan → Komite & admin**; penerima membuka taut `/admin/invite/[token]`, onboarding sandi+nama → `signUpEmail` + `AdminProfile`. Jika email pengguna sudah ada, pakai dialog **Tautkan admin (email sudah ada)** (tambahkan ke UI jika belum ada label yang sama).
```

Selaraskan label tombol/dialog lama **`Tambah admin`** menjadi dua entri eksplisit jika perlu (**Undang baru** vs **Tautkan email ada**) — **opsional UX** satu commit terpisah atau dalam commit ini.

- [ ] **Verifikasi penuh**

```bash
pnpm lint && pnpm test && pnpm check-types
```

Expected: **exit code 0**.

- [ ] **Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mention owner admin invite flow in CLAUDE"
```

---

## Smoke manual (wajib sebelum klaim siap prod)

1. **`BETTER_AUTH_URL`** mengarah ke origin yang bisa dibuka untuk uji taut undangan (mis. `http://localhost:3000`).
2. Owner → **Komite**: **Undang** email baru tanpa akun → salin taut jika SMTP off → buka taut inkognito → isi nama/sandi → sampai **`/admin/sign-in`** → masuk.
3. Cuba undangan untuk email yang sudah ada user (tanpa profil admin) → harus gagal sesuai pesan **Tautkan admin**.
4. **Batalkan** undangan tertunda → taut lama **`notFound`** atau pesandibatalkan.
5. Resend dikonfigurasi → email diterima (opsional staging).

---

## Self-review penulis rencana

1. **Cakupan spesifikasi:** model + TTL + larangan Owner + satu aktif + benturan User/Profile + audit tiga titik + email/URL fallback + halaman onboarding + `/admin/sign-in` + daftar Undangan tertunda semuanya termasuk dalam tugas berurutan di atas.
2. **Tanpa placeholder:** tidak ada langkah kosong atau “implement later”.
3. **Tipe konsisten:** nama kolom sama dengan Snippet Prisma (`emailNormalized`, `tokenHash`).
4. **Celah kecil untuk implementer:** kesesuaian tipe **`auth.api.signUpEmail`** ikuti error kompilator Next/Better Auth; pastikan **`encodeURIComponent`** pada token konsisten antara build URL (`buildAdminInviteAcceptUrl` memanggil ini) dan **`page.tsx`** menggunakan `decodeURIComponent` sekali untuk segmen `[token]` (sesuaikan bila middleware mengubah string).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-admin-invite-onboarding-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Satu subagen per task, review antar task, iterasi cepat.

**2. Inline Execution** — Jalankan task dalam sesi ini dengan executing-plans, eksekusi berkelompok dengan checkpoint.

**Which approach?**
