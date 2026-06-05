# Modal Komunikasi WA Saja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus seluruh UI email otomatis dari `RegistrationCommsDialog` sehingga modal hanya menampilkan pratinjau WhatsApp; bersihkan dead code terkait.

**Architecture:** Sederhanakan komponen client dialog dengan menghapus state, effect, dan server action preview email. Pemanggil di tab Verifikasi dan Operasi cukup lewat props WA. Hapus file server action yang tidak dipakai; update `CLAUDE.md`.

**Tech Stack:** Next.js App Router, React client component, Better Auth guards (tidak diubah), Prisma (tidak diubah).

**Spec:** `docs/superpowers/specs/2026-06-05-registration-comms-wa-only-design.md`

---

## File map

| File | Aksi |
| ---- | ---- |
| `src/components/admin/registration-comms-dialog.tsx` | Modify — WA-only dialog |
| `src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx` | Modify — hapus prop `contactEmail` |
| `src/components/admin/registration-detail-panels/tab-operations/operations-tab-client.tsx` | Modify — hapus prop `contactEmail` |
| `src/lib/actions/admin-registration-lifecycle-email.ts` | Delete |
| `CLAUDE.md` | Modify — hapus modul + perbarui deskripsi dialog |

---

### Task 1: Sederhanakan `RegistrationCommsDialog`

**Files:**
- Modify: `src/components/admin/registration-comms-dialog.tsx`

- [ ] **Step 1: Ganti isi file dengan implementasi WA-only**

```tsx
'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RegistrationNotifyPayload } from '@/lib/wa-templates/build-registration-notify'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wa: RegistrationNotifyPayload | null
}

export function RegistrationCommsDialog({ open, onOpenChange, wa }: Props) {
  if (!wa) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{wa.titleId}</DialogTitle>
          <DialogDescription>
            Kirim notifikasi ke pendaftar via WhatsApp. Pesan dapat diedit di aplikasi WhatsApp setelah dibuka.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className='text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide'>WhatsApp</p>
          <pre className='max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap'>
            {wa.preview}
          </pre>
        </div>

        {!wa.canOpen && wa.disabledReasonId ? (
          <p className='text-sm text-muted-foreground'>{wa.disabledReasonId}</p>
        ) : null}

        <DialogFooter className='flex-col gap-2 sm:flex-row sm:justify-end'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Lewati
          </Button>
          {wa.canOpen ? (
            <a
              target='_blank'
              rel='noopener noreferrer'
              href={wa.href}
              onClick={() => onOpenChange(false)}
              className={buttonVariants()}
            >
              Buka WhatsApp
            </a>
          ) : (
            <Button type='button' disabled>
              Buka WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Jalankan lint pada file yang diubah**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint -- --max-warnings=0 src/components/admin/registration-comms-dialog.tsx
```

Expected: tidak ada error ESLint.

---

### Task 2: Perbarui pemanggil dialog

**Files:**
- Modify: `src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-operations/operations-tab-client.tsx`

- [ ] **Step 1: `decision-section.tsx` — kurangi props dialog**

Ganti blok:

```tsx
        <RegistrationCommsDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          wa={notifyPayload}
          eventId={eventId}
          registrationId={registration.id}
          kind={notifyKind}
          contactEmail={contact.email}
        />
```

Menjadi:

```tsx
        <RegistrationCommsDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          wa={notifyPayload}
        />
```

- [ ] **Step 2: `operations-tab-client.tsx` — kurangi props dialog**

Ganti blok yang sama (hapus `eventId`, `registrationId`, `kind`, `contactEmail`).

- [ ] **Step 3: Lint kedua file**

```bash
pnpm lint -- --max-warnings=0 \
  src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx \
  src/components/admin/registration-detail-panels/tab-operations/operations-tab-client.tsx
```

Expected: tidak ada error ESLint.

---

### Task 3: Hapus dead code server action

**Files:**
- Delete: `src/lib/actions/admin-registration-lifecycle-email.ts`

- [ ] **Step 1: Hapus file**

```bash
rm src/lib/actions/admin-registration-lifecycle-email.ts
```

- [ ] **Step 2: Pastikan tidak ada import tersisa**

```bash
rg "admin-registration-lifecycle-email|previewRegistrationCommsEmail" src/
```

Expected: tidak ada match di `src/`.

---

### Task 4: Update dokumentasi

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Hapus baris modul di Key library modules**

Hapus baris:

```
- `lib/actions/admin-registration-lifecycle-email.ts` — `previewRegistrationCommsEmail` untuk pratinjau isi email otomatis di dialog WA pasca-keputusan
```

- [ ] **Step 2: Perbarui deskripsi `registration-comms-dialog.tsx` di section UI components**

Ubah teks `(WA + pratinjau email otomatis, tanpa kirim ulang manual)` menjadi `(dialog WA pasca-keputusan/operasi; pratinjau pesan + Buka WhatsApp / Lewati)`.

---

### Task 5: Verifikasi & commit

- [ ] **Step 1: Typecheck build ringan**

```bash
pnpm lint
```

Expected: pass.

- [ ] **Step 2: Commit**

```bash
git add \
  src/components/admin/registration-comms-dialog.tsx \
  src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx \
  src/components/admin/registration-detail-panels/tab-operations/operations-tab-client.tsx \
  CLAUDE.md
git add -u src/lib/actions/admin-registration-lifecycle-email.ts
git commit -m "$(cat <<'EOF'
refactor(admin): modal komunikasi hanya WhatsApp

Hapus pratinjau dan keterangan email otomatis dari RegistrationCommsDialog;
bersihkan previewRegistrationCommsEmail yang tidak dipakai.
EOF
)"
```

- [ ] **Step 3: Verifikasi manual (dev server)**

1. Buka detail registrasi → tab Verifikasi → simpan approve/reject/payment issue.
2. Modal hanya menampilkan pratinjau WA; tidak ada blok "Email (otomatis)".
3. Tab Operasi → cancel/refund atau pengingat kekurangan → pola sama.
4. (Opsional) Konfirmasi email otomatis tetap terkirim lewat pengaturan komite.

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| Hapus blok email + fallback | Task 1 |
| DialogDescription WA-only | Task 1 |
| Hapus prop `contactEmail` | Task 2 |
| Hapus `previewRegistrationCommsEmail` | Task 3 |
| Update `CLAUDE.md` | Task 4 |
| Backend email otomatis tidak diubah | (no task — intentional) |
