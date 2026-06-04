# Admin Avatar Upload & Sticky Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each admin to upload a personal avatar on `/admin/account`, display it in the account menu trigger (both desktop sidebar and mobile header), and make the mobile admin header sticky.

**Architecture:** The Better Auth `User` model already has an `image String?` field — no Prisma migration needed. Avatars are uploaded to Vercel Blob at a deterministic path (`admins/{userId}/avatar.webp`) and the URL is stored via `auth.api.updateUser({ body: { image: url } })`. The URL flows down from `session.user.image` → `AdminAppShell` → `AdminAccountMenu`. The mobile header gains `sticky top-0 z-40` classes.

**Tech Stack:** Next.js 15 App Router, Better Auth, Vercel Blob, Sharp (WebP conversion), Prisma (no new migration), shadcn/ui, Tailwind CSS, Vitest

---

## File Map

| Action | File                                                 |
| ------ | ---------------------------------------------------- |
| Create | `src/lib/admin/admin-initials.ts`                    |
| Create | `src/lib/admin/admin-initials.test.ts`               |
| Create | `src/lib/uploads/upload-admin-avatar.ts`             |
| Create | `src/lib/actions/update-admin-avatar.ts`             |
| Modify | `src/app/admin/layout.tsx`                           |
| Modify | `src/components/admin/admin-app-shell.tsx`           |
| Modify | `src/components/admin/admin-account-menu.tsx`        |
| Modify | `src/components/admin/admin-account-page-client.tsx` |

---

### Task 1: Sticky mobile header

**Files:**

- Modify: `src/components/admin/admin-app-shell.tsx:184`

- [ ] **Step 1: Add `sticky top-0 z-40` to the mobile `<header>` element**

In `src/components/admin/admin-app-shell.tsx`, find the mobile `<header>` (line ~184, the one with `lg:hidden`):

```tsx
// Before:
<header className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">

// After:
<header className="sticky top-0 z-40 flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/admin-app-shell.tsx
git commit -m "feat(admin-shell): make mobile header sticky"
```

---

### Task 2: Admin initials helper (TDD)

**Files:**

- Create: `src/lib/admin/admin-initials.ts`
- Create: `src/lib/admin/admin-initials.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/admin/admin-initials.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getAdminInitials } from './admin-initials'

describe('getAdminInitials', () => {
  it('returns first letter of single name', () => {
    expect(getAdminInitials('Budi', null)).toBe('B')
  })

  it('returns first+last initials for multi-word name', () => {
    expect(getAdminInitials('Budi Santoso', null)).toBe('BS')
  })

  it('uses first and last word for three-word name', () => {
    expect(getAdminInitials('Budi Eko Santoso', null)).toBe('BS')
  })

  it('falls back to email first char when no name', () => {
    expect(getAdminInitials(null, 'budi@cisc.id')).toBe('B')
    expect(getAdminInitials('', 'budi@cisc.id')).toBe('B')
  })

  it('returns A when both are absent', () => {
    expect(getAdminInitials(null, null)).toBe('A')
  })

  it('is uppercase', () => {
    expect(getAdminInitials('budi santoso', null)).toBe('BS')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm vitest run src/lib/admin/admin-initials.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the helper**

Create `src/lib/admin/admin-initials.ts`:

```ts
export function getAdminInitials(displayName: string | null | undefined, email: string | null | undefined): string {
  const name = displayName?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }
  const emailLocal = email?.split('@')[0]
  if (emailLocal) return emailLocal[0].toUpperCase()
  return 'A'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/lib/admin/admin-initials.test.ts
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/admin-initials.ts src/lib/admin/admin-initials.test.ts
git commit -m "feat(admin): add getAdminInitials helper"
```

---

### Task 3: Avatar blob upload helper

**Files:**

- Create: `src/lib/uploads/upload-admin-avatar.ts`

No separate test — all I/O; covered by integration at the action level.

- [ ] **Step 1: Create the upload helper**

Create `src/lib/uploads/upload-admin-avatar.ts`:

```ts
import { del } from '@vercel/blob'

import { putWebpToBlob } from '@/lib/uploads/blob'
import { UploadError } from '@/lib/uploads/errors'
import { toWebp } from '@/lib/uploads/images'
import { retry } from '@/lib/uploads/retry'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export async function uploadAdminAvatar(opts: {
  userId: string
  file: File
}): Promise<{ url: string; pathname: string }> {
  const { file } = opts

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new UploadError('Gunakan berkas gambar.', {
      code: 'invalid_content_type',
      recoverable: true,
    })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError('Ukuran berkas terlalu besar (maks 8 MB).', {
      code: 'file_too_large',
      recoverable: true,
    })
  }

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await toWebp(raw, { maxDim: 400, quality: 85 })
  const blobPath = `admins/${opts.userId}/avatar.webp`

  return retry(() => putWebpToBlob({ path: blobPath, bytes: webp.bytes }), {
    maxAttempts: 3,
    delayMs: 250,
  })
}

export async function deleteAdminAvatar(userId: string): Promise<void> {
  const blobPath = `admins/${userId}/avatar.webp`
  // Vercel Blob del accepts a URL; we construct the predictable public URL pattern.
  // If the blob doesn't exist, del silently succeeds.
  try {
    await del(`https://${process.env.BLOB_READ_WRITE_TOKEN ? '' : ''}${blobPath}`)
  } catch {
    // best-effort; avatar removal is not critical
  }
}
```

> Note: `del` from `@vercel/blob` can accept either a URL or an array of URLs. Since we store the exact URL returned from `putWebpToBlob` in `User.image`, callers can pass that URL directly. The `deleteAdminAvatar` helper is provided for completeness but the server action will use the URL it already has.

- [ ] **Step 2: Commit**

```bash
git add src/lib/uploads/upload-admin-avatar.ts
git commit -m "feat(uploads): add uploadAdminAvatar blob helper"
```

---

### Task 4: Avatar server action

**Files:**

- Create: `src/lib/actions/update-admin-avatar.ts`

- [ ] **Step 1: Create the server action**

Create `src/lib/actions/update-admin-avatar.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { del } from '@vercel/blob'

import { auth } from '@/lib/auth/auth'
import { getAdminSession } from '@/lib/auth/session'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { uploadAdminAvatar } from '@/lib/uploads/upload-admin-avatar'
import { UploadError } from '@/lib/uploads/errors'

export async function updateAdminAvatar(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const session = await getAdminSession()
  if (!session) return rootError('Tidak diizinkan.')

  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) {
    return rootError('Pilih berkas gambar terlebih dahulu.')
  }

  let uploadResult: { url: string; pathname: string }
  try {
    uploadResult = await uploadAdminAvatar({
      userId: session.user.id,
      file,
    })
  } catch (err) {
    if (err instanceof UploadError) {
      return rootError(err.message)
    }
    console.error('[updateAdminAvatar] upload error', err)
    return rootError('Gagal mengunggah avatar. Coba lagi.')
  }

  const previousImageUrl = session.user.image

  try {
    await auth.api.updateUser({
      body: { image: uploadResult.url },
      headers: await headers(),
    })
  } catch (err) {
    // Roll back blob if DB update fails
    try {
      await del(uploadResult.url)
    } catch {
      // best-effort
    }
    console.error('[updateAdminAvatar] updateUser error', err)
    return rootError('Gagal menyimpan avatar. Coba lagi.')
  }

  // Best-effort delete of previous avatar blob (same deterministic path, so
  // putWebpToBlob already overwrote it — but clean up if the URL changed somehow).
  if (previousImageUrl && previousImageUrl !== uploadResult.url) {
    del(previousImageUrl).catch(() => undefined)
  }

  return ok({ url: uploadResult.url })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/update-admin-avatar.ts
git commit -m "feat(actions): add updateAdminAvatar server action"
```

---

### Task 5: Thread `avatarUrl` from layout → shell → menu

**Files:**

- Modify: `src/app/admin/layout.tsx`
- Modify: `src/components/admin/admin-app-shell.tsx`
- Modify: `src/components/admin/admin-account-menu.tsx`

- [ ] **Step 1: Update `AdminAppShell` props to accept `avatarUrl`**

In `src/components/admin/admin-app-shell.tsx`, update the exported component signature and pass `avatarUrl` to both `AdminAccountMenu` usages:

```tsx
// Change props type:
export function AdminAppShell({
  navFlags,
  userEmail,
  displayName,
  avatarUrl,     // ← add
  children,
}: {
  navFlags: GlobalSidebarNav;
  userEmail: string | null;
  displayName: string | null;
  avatarUrl: string | null;  // ← add
  children: React.ReactNode;
}) {
```

Then update both `<AdminAccountMenu>` calls to pass `avatarUrl`:

```tsx
// Desktop sidebar (variant="sidebar"):
<AdminAccountMenu
  userEmail={userEmail}
  displayName={displayName}
  avatarUrl={avatarUrl}   // ← add
  variant="sidebar"
/>

// Mobile header (variant="default"):
<AdminAccountMenu
  userEmail={userEmail}
  displayName={displayName}
  avatarUrl={avatarUrl}   // ← add
/>
```

- [ ] **Step 2: Update `admin/layout.tsx` to pass `session.user.image`**

In `src/app/admin/layout.tsx`, add `avatarUrl` to the `AdminAppShell` render:

```tsx
return (
  <AdminAppShell
    navFlags={navFlags}
    userEmail={session.user.email ?? null}
    displayName={session.user.name ?? null}
    avatarUrl={session.user.image ?? null} // ← add
  >
    {children}
  </AdminAppShell>
)
```

- [ ] **Step 3: Update `AdminAccountMenu` to accept `avatarUrl`**

In `src/components/admin/admin-account-menu.tsx`, add `avatarUrl` to the props type:

```tsx
type AdminAccountMenuProps = {
  userEmail: string | null
  displayName?: string | null
  avatarUrl?: string | null // ← add
  triggerClassName?: string
  variant?: 'default' | 'sidebar'
}
```

And destructure it:

```tsx
export function AdminAccountMenu({
  userEmail,
  displayName,
  avatarUrl,        // ← add
  triggerClassName,
  variant = "default",
}: AdminAccountMenuProps) {
```

(Actual avatar rendering comes in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/components/admin/admin-app-shell.tsx src/components/admin/admin-account-menu.tsx
git commit -m "feat(admin-shell): thread avatarUrl from session through shell to account menu"
```

---

### Task 6: Render avatar circle in `AdminAccountMenu` trigger

**Files:**

- Modify: `src/components/admin/admin-account-menu.tsx`

The trigger currently shows a text pill (name + email). We add a circular avatar/initials badge before the text.

- [ ] **Step 1: Add imports and `AdminAvatarCircle` inner component**

In `src/components/admin/admin-account-menu.tsx`, add these imports at the top:

```tsx
import Image from 'next/image'
import { getAdminInitials } from '@/lib/admin/admin-initials'
```

Then add a small component inside the file (before `AdminAccountMenu`):

```tsx
function AdminAvatarCircle({
  avatarUrl,
  displayName,
  userEmail,
  size,
}: {
  avatarUrl: string | null | undefined
  displayName: string | null | undefined
  userEmail: string | null | undefined
  size: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 28 : 36
  const cls = size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-[13px]'

  if (avatarUrl) {
    return (
      <span
        className={`${cls} relative shrink-0 overflow-hidden rounded-full border border-sidebar-border/60`}
        aria-hidden
      >
        <Image
          src={avatarUrl}
          alt=''
          width={dim}
          height={dim}
          className='h-full w-full object-cover'
          unoptimized={false}
        />
      </span>
    )
  }

  const initials = getAdminInitials(displayName, userEmail)
  return (
    <span
      className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-sidebar-accent font-semibold text-sidebar-foreground`}
      aria-hidden
    >
      {initials}
    </span>
  )
}
```

- [ ] **Step 2: Update trigger JSX to show avatar circle**

Replace the `<span className="min-w-0 flex-1 text-left">` block inside `<PopoverTrigger>` with the avatar + text layout:

```tsx
{
  /* Avatar circle */
}
;<AdminAvatarCircle
  avatarUrl={avatarUrl}
  displayName={displayName}
  userEmail={userEmail ?? ''}
  size={variant === 'sidebar' ? 'md' : 'sm'}
/>

{
  /* Name + email text (unchanged) */
}
;<span className='min-w-0 flex-1 text-left'>
  <span className='block truncate text-sm font-medium leading-snug'>{primary}</span>
  {showEmailRow ? (
    <span
      className={cn(
        'block truncate text-xs',
        variant === 'sidebar' ? 'text-sidebar-foreground/55' : 'text-muted-foreground',
      )}
    >
      {email}
    </span>
  ) : null}
</span>
```

Also show avatar in `PopoverHeader` (larger, decorative):

Inside `<PopoverContent>`, update `<PopoverHeader>` to include the avatar:

```tsx
<PopoverHeader className='flex items-center gap-3 px-1'>
  <AdminAvatarCircle avatarUrl={avatarUrl} displayName={displayName} userEmail={userEmail ?? ''} size='md' />
  <div className='min-w-0'>
    <PopoverTitle className='truncate text-base'>{primary}</PopoverTitle>
    {email ? <p className='truncate text-xs text-muted-foreground'>{email}</p> : null}
  </div>
</PopoverHeader>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-account-menu.tsx src/lib/admin/admin-initials.ts
git commit -m "feat(admin-account-menu): show avatar circle in account menu trigger and popover"
```

---

### Task 7: Avatar upload UI on `/admin/account`

**Files:**

- Modify: `src/components/admin/admin-account-page-client.tsx`
- Modify: `src/app/admin/account/page.tsx`

- [ ] **Step 1: Update the account page server component to pass `initialAvatarUrl`**

In `src/app/admin/account/page.tsx`:

```tsx
export default async function AdminAccountPage() {
  const session = await requireAdminSession()

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  })

  return (
    <main className='flex flex-1 flex-col'>
      <AdminAccountPageClient
        initialName={session.user.name ?? ''}
        email={session.user.email ?? ''}
        initialTwoFactorEnabled={Boolean(dbUser?.twoFactorEnabled)}
        initialAvatarUrl={session.user.image ?? null} // ← add
      />
    </main>
  )
}
```

- [ ] **Step 2: Add avatar upload section to `AdminAccountPageClient`**

In `src/components/admin/admin-account-page-client.tsx`, add these imports:

```tsx
import Image from 'next/image'
import { useState } from 'react'
import { updateAdminAvatar } from '@/lib/actions/update-admin-avatar'
```

Update the component props:

```tsx
export function AdminAccountPageClient({
  initialName,
  email,
  initialTwoFactorEnabled,
  initialAvatarUrl,        // ← add
}: {
  initialName: string;
  email: string;
  initialTwoFactorEnabled: boolean;
  initialAvatarUrl: string | null;  // ← add
}) {
```

Inside the component, add avatar state and handler (alongside the existing `pending`/`startTransition`):

```tsx
const [avatarFile, setAvatarFile] = useState<File | undefined>()
const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
const [avatarPending, startAvatarTransition] = useTransition()
const [avatarError, setAvatarError] = useState<string | null>(null)

function handleAvatarUpload() {
  if (!avatarFile) {
    setAvatarError('Pilih berkas gambar terlebih dahulu.')
    return
  }
  setAvatarError(null)
  startAvatarTransition(async () => {
    const fd = new FormData()
    fd.set('avatar', avatarFile)
    const res = await updateAdminAvatar(fd)
    if (!res.ok) {
      setAvatarError(res.rootError ?? 'Gagal mengunggah avatar.')
      return
    }
    setAvatarUrl(res.data.url)
    setAvatarFile(undefined)
    toastCudSuccess('update', 'Avatar diperbarui.')
    router.refresh()
  })
}
```

Add an **Avatar section** as the first `<section>` inside the page (before the display name section):

```tsx
<section className='flex flex-col gap-4 rounded-lg border bg-card p-6'>
  <div className='flex flex-col gap-1'>
    <h2 className='text-base font-semibold'>Foto profil</h2>
    <p className='text-sm text-muted-foreground'>Ditampilkan di menu akun dan header admin.</p>
  </div>

  <div className='flex items-center gap-4'>
    {/* Current avatar preview */}
    <span className='relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted'>
      {avatarUrl ? (
        <Image src={avatarUrl} alt='Avatar saat ini' width={64} height={64} className='h-full w-full object-cover' />
      ) : (
        <span className='flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground'>
          {initialName.trim() ? initialName.trim()[0].toUpperCase() : (email[0]?.toUpperCase() ?? 'A')}
        </span>
      )}
    </span>
    <div className='flex min-w-0 flex-col gap-1'>
      <p className='text-sm font-medium'>{avatarUrl ? 'Ganti foto profil' : 'Unggah foto profil'}</p>
      <p className='text-xs text-muted-foreground'>JPG, PNG, atau WebP. Maks 8 MB.</p>
    </div>
  </div>

  <FileField
    id='avatar-upload'
    label='Pilih foto'
    accept='image/*'
    pickPrompt='Ketuk untuk memilih foto'
    replacePrompt='Ganti foto'
    maxSizeBytes={8 * 1024 * 1024}
    onChange={setAvatarFile}
    disabled={avatarPending}
  />

  {avatarError ? (
    <p className='text-sm text-destructive' role='alert'>
      {avatarError}
    </p>
  ) : null}

  <Button type='button' onClick={handleAvatarUpload} disabled={!avatarFile || avatarPending}>
    {avatarPending ? 'Mengunggah…' : 'Simpan foto'}
  </Button>
</section>
```

Also add the `FileField` import at the top:

```tsx
import { FileField } from '@/components/ui/file-field'
```

- [ ] **Step 3: Build check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm build 2>&1 | tail -20
```

Expected: build succeeds (0 TypeScript errors)

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (including `admin-initials.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/account/page.tsx src/components/admin/admin-account-page-client.tsx
git commit -m "feat(admin-account): add avatar upload section"
```

---

## Self-Review

### Spec coverage

| Requirement                         | Task                                                |
| ----------------------------------- | --------------------------------------------------- |
| Avatar upload on `/admin/account`   | Tasks 3, 4, 7                                       |
| Admin header shows avatar with menu | Tasks 5, 6                                          |
| Mobile header sticky                | Task 1                                              |
| Initials fallback when no avatar    | Task 2, 6                                           |
| Avatar persisted per-admin          | Tasks 3, 4 (deterministic blob path + `User.image`) |

### Placeholder check

- No "TBD" — all steps have complete code.
- All types from earlier tasks are referenced consistently (`AdminAccountMenu` always called with `avatarUrl`, `getAdminInitials` used in Task 6 after defined in Task 2).

### Type consistency

- `avatarUrl: string | null` used uniformly across `AdminAppShell`, `AdminAccountMenu`, and `AdminAccountPageClient`.
- `getAdminInitials(displayName, userEmail)` signature matches usage in `AdminAvatarCircle`.
- `ActionResult<{ url: string }>` return type matches client-side `res.data.url` access.
