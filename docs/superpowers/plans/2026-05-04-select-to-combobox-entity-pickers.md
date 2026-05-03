# Migrasi Select → Combobox untuk Pemilih Entitas (Label, Bukan ID)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti `<Select>` menjadi `<Combobox>` (primitif Base UI di `src/components/ui/combobox.tsx`) pada pemilih yang **menyimpan ID/UUID** namun harus menampilkan **label manusia** (nama, judul, rekening, menu, dsb.) di field tertutup dan saat mencari — bukan string ID mentah yang muncul jika opsi hilang, nilai kosong (`""`), atau perilaku `SelectValue` yang tidak cocok.

**Architecture:** Tambah satu komponen klien terfokus `EntityCombobox` yang membungkus `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, dan `ComboboxValue` dengan API `value: string | null`, `onValueChange`, `options[]` (value + label + optional keywords untuk filter). Gunakan `ComboboxValue` dengan **children berbentuk fungsi** `(selected) => ReactNode` agar label di-resolve dari map opsi — sehingga selalu aman untuk UUID. Gunakan `value={null}` bila belum memilih; **jangan** mengikat `value=""` ke Root. Untuk pencarian, beri prop `filter` pada `Combobox` Root yang membandingkan query dengan `label` + `keywords` tiap opsi (lihat [Base UI Combobox](https://base-ui.com/react/components/combobox)). Jika perlu perilaku `Intl.Collator` seperti hook bawaan, bisa mengganti body filter dengan `Combobox.useFilter` dari `@base-ui/react` setelah pola manual ini stabil. Select untuk enum pendek (status, mode menu, boolean) dan filter URL (`all` / `linked`) **tetap Select**.

**Tech Stack:** React 19, `@base-ui/react` (Combobox namespace + `useFilter`), `src/components/ui/combobox.tsx`, react-hook-form `Controller`, Vitest (hanya util murni; tanpa tes DOM).

---

## Inventaris Select berbasis ID (calon migrasi)

| File | Field | Nilai tersimpan | Label yang ditampilkan |
|------|--------|-----------------|-------------------------|
| `src/components/admin/forms/event-admin-form.tsx` | `venueId` | venue id | `venue.name` |
| Sama | `picAdminProfileId` | admin profile id | `p.label` |
| Sama | `bankAccountId` | bank row id | `b.label` |
| `src/components/admin/voucher-redemption-panel.tsx` | pilihan per tiket | `menuItemId` | nama + harga IDR |
| `src/components/admin/management-member-form-dialog.tsx` | `masterMemberId` | member id atau sentinel | `memberNumber — fullName` / placeholder tautan |
| `src/components/admin/management-assignment-form-dialog.tsx` | `managementMemberId` | management member id | nama + kode publik |
| Sama | `boardRoleId` | role id | `r.title` (opsional combobox; daftar bisa panjang) |
| `src/components/admin/management-role-form-dialog.tsx` | `parentRoleId` | role id atau sentinel | judul jabatan / "Tidak ada induk" |

**Tidak dimigrasi (tetap Select):** `member-validation-panel.tsx`, filter di `management-*-page.tsx`, enum di `event-admin-form.tsx` (status, pricing, menu mode), `club-audit-log-action-select.tsx`, `isUnique` di `management-role-form-dialog.tsx`.

---

## Peta file

| Aksi | File | Tanggung jawab |
|------|------|----------------|
| **Create** | `src/lib/ui/entity-combobox-label.ts` | Lookup label dari opsi untuk nilai yang dipilih (murni, mudah ditest). |
| **Create** | `src/lib/ui/entity-combobox-label.test.ts` | Vitest untuk lookup + edge case UUID tak dikenal. |
| **Create** | `src/components/ui/entity-combobox.tsx` | Komponen `EntityCombobox` + opsi sentinel / nullable. |
| **Modify** | `src/components/admin/forms/event-admin-form.tsx` | Ganti 3 Select entitas dengan `EntityCombobox` + Controller / setValue seperti sekarang. |
| **Modify** | `src/components/admin/voucher-redemption-panel.tsx` | Ganti Select per tiket; state: `undefined`/`null` vs string id (bukan `""`). |
| **Modify** | `src/components/admin/management-member-form-dialog.tsx` | Ganti Select master member. |
| **Modify** | `src/components/admin/management-assignment-form-dialog.tsx` | Ganti Select pengurus; opsional role. |
| **Modify** | `src/components/admin/management-role-form-dialog.tsx` | Ganti Select jabatan induk. |

---

### Task 1: Util lookup label

**Files:**
- Create: `src/lib/ui/entity-combobox-label.ts`
- Create: `src/lib/ui/entity-combobox-label.test.ts`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `src/lib/ui/entity-combobox-label.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { labelForOptionValue } from "./entity-combobox-label";

describe("labelForOptionValue", () => {
  const opts = [
    { value: "a", label: "Satu" },
    { value: "b", label: "Dua", keywords: "alias" },
  ];

  it("returns null when value is null", () => {
    expect(labelForOptionValue(opts, null)).toBeNull();
  });

  it("returns label for known value", () => {
    expect(labelForOptionValue(opts, "a")).toBe("Satu");
  });

  it("returns null for unknown value so UI can show placeholder not raw id", () => {
    expect(labelForOptionValue(opts, "unknown-uuid")).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan tes — harus gagal**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/ui/entity-combobox-label.test.ts
```

Expected: FAIL (modul / fungsi tidak ada).

- [ ] **Step 3: Implementasi minimal**

Buat `src/lib/ui/entity-combobox-label.ts`:

```typescript
export type EntityComboboxOptionRow = {
  value: string;
  label: string;
  /** Teks tambahan untuk filter (tidak ditampilkan sebagai label utama). */
  keywords?: string;
};

export function labelForOptionValue(
  options: readonly EntityComboboxOptionRow[],
  value: string | null,
): string | null {
  if (value === null) return null;
  const hit = options.find((o) => o.value === value);
  return hit?.label ?? null;
}
```

- [ ] **Step 4: Jalankan tes — harus lulus**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/ui/entity-combobox-label.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/entity-combobox-label.ts src/lib/ui/entity-combobox-label.test.ts
git commit -m "test(ui): entity combobox label lookup helper"
```

---

### Task 2: Komponen `EntityCombobox`

**Files:**
- Create: `src/components/ui/entity-combobox.tsx`

**Catatan:** Primitif proyek memakai `ComboboxInput` dengan `render={<InputGroupInput .../>}` — ikuti gaya tersebut. Untuk aksesibilitas, set `id` / `aria-invalid` pada input grup jika ada.

- [ ] **Step 1: Tambahkan komponen (satu file lengkap)**

Buat `src/components/ui/entity-combobox.tsx`:

```tsx
"use client";

import * as React from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  labelForOptionValue,
  type EntityComboboxOptionRow,
} from "@/lib/ui/entity-combobox-label";

function matchQuery(row: EntityComboboxOptionRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === "") return true;
  const hay = `${row.label} ${row.keywords ?? ""}`.toLowerCase();
  return hay.includes(needle);
}

export type EntityComboboxProps = {
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** null = belum memilih; jangan gunakan "" */
  value: string | null;
  onValueChange: (next: string | null) => void;
  options: readonly EntityComboboxOptionRow[];
  "aria-invalid"?: boolean;
};

export function EntityCombobox({
  id,
  className,
  disabled,
  placeholder = "Pilih…",
  value,
  onValueChange,
  options,
  "aria-invalid": ariaInvalid,
}: EntityComboboxProps) {
  return (
    <Combobox
      value={value}
      onValueChange={(next, _eventDetail) => {
        onValueChange((next ?? null) as string | null);
      }}
      disabled={disabled}
      filter={(itemValue: string, query: string) => {
        const row = options.find((o) => o.value === itemValue);
        if (!row) return false;
        return matchQuery(row, query);
      }}
      items={options.map((o) => o.value)}
      autoComplete="list"
      modal={false}
      className={cn("w-full", className)}
    >
      <ComboboxInput
        id={id}
        showClear={value !== null}
        disabled={disabled}
        className="w-full"
        aria-invalid={ariaInvalid}
      >
        <ComboboxValue placeholder={placeholder}>
          {(selected: unknown) => {
            const idStr = typeof selected === "string" ? selected : null;
            const label = labelForOptionValue(options, idStr);
            return label ?? placeholder;
          }}
        </ComboboxValue>
      </ComboboxInput>
      <ComboboxContent className="w-[var(--anchor-width)] min-w-[var(--anchor-width)]">
        <ComboboxList>
          {options.map((row) => (
            <ComboboxItem key={row.value} value={row.value} disabled={disabled}>
              {row.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
        <ComboboxEmpty>Tidak ada hasil.</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
```

**Penyesuaian setelah uji manual:** Jika Root menolak `items` bersamaan dengan daftar `<ComboboxItem>` manual, hapus prop `items` dan andalkan saja `<ComboboxList>` / item (pastikan filter tetap dipanggil — uji ketik query). Jika `onValueChange` tidak pernah mengirim `null` saat clear, set `showClear={false}` atau tangani lewat dokumentasi Base UI untuk `Clear`.

- [ ] **Step 2: Cek typecheck / lint pada file baru**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit
pnpm lint
```

Perbaiki error tipe pada signature `onValueChange` / `value` jika perlu (mis. cast atau narrow event).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/entity-combobox.tsx
git commit -m "feat(ui): EntityCombobox for id-backed options with labels"
```

---

### Task 3: `event-admin-form.tsx` — venue, PIC, rekening

**Files:**
- Modify: `src/components/admin/forms/event-admin-form.tsx` (impor + tiga field)

- [ ] **Step 1: Bangun opsi untuk `EntityCombobox` dari data yang sudah ada**

Di dalam komponen (dekat `venueOptions`, `props.picOptions`, `bankChoices`), tambahkan memo:

```tsx
const venueComboboxOptions = React.useMemo(
  () =>
    venueOptions.map((v) => ({
      value: v.id,
      label: v.name,
      keywords: v.name,
    })),
  [venueOptions],
);

const picComboboxOptions = React.useMemo(
  () =>
    props.picOptions.map((p) => ({
      value: p.id,
      label: p.label,
      keywords: p.label,
    })),
  [props.picOptions],
);

const bankComboboxOptions = React.useMemo(
  () =>
    bankChoices.map((b) => ({
      value: b.id,
      label: b.label,
      keywords: b.label,
    })),
  [bankChoices],
);
```

- [ ] **Step 2: Ganti Controller `venueId`**

Ganti blok `<Select>…</Select>` venue dengan:

```tsx
<Controller
  control={form.control}
  name="venueId"
  render={({ field }) => (
    <EntityCombobox
      disabled={pending || lockedMenuKeys.includes("venueId")}
      placeholder="Pilih venue"
      value={field.value}
      onValueChange={(next) => {
        if (next === null) return;
        field.onChange(next);
        setLinkedVenueMenusFromVenueSelection(next);
      }}
      options={venueComboboxOptions}
    />
  )}
/>
```

Jika formulir mengharuskan venue selalu terisi, tetap blokir `onValueChange(null)` seperti di atas.

- [ ] **Step 3: Ganti Select PIC utama dan rekening**

Untuk PIC:

```tsx
<EntityCombobox
  disabled={pending}
  placeholder="Pilih PIC"
  value={picId === "" ? null : picId}
  onValueChange={(next) => {
    if (next === null) return;
    form.setValue("picAdminProfileId", next, { shouldDirty: true });
    const first = props.banksByPic[next]?.[0]?.id ?? "";
    form.setValue("bankAccountId", first, { shouldDirty: true });
  }}
  options={picComboboxOptions}
/>
```

Untuk rekening:

```tsx
<EntityCombobox
  disabled={pending || bankChoices.length === 0}
  placeholder="Pilih rekening"
  value={bankAccountId === "" ? null : bankAccountId}
  onValueChange={(next) => {
    if (next === null) return;
    form.setValue("bankAccountId", next, { shouldDirty: true });
  }}
  options={bankComboboxOptions}
/>
```

Sesuaikan jika schema memakai string kosong berbeda — normalisasi ke `null` hanya untuk prop `EntityCombobox`.

- [ ] **Step 4: Hapus impor Select yang tidak terpakai (hanya untuk tiga blok ini)**

Tambahkan: `import { EntityCombobox } from "@/components/ui/entity-combobox";`

- [ ] **Step 5: Jalankan lint + tes**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx
git commit -m "feat(admin): use EntityCombobox for venue PIC and bank on event form"
```

---

### Task 4: `voucher-redemption-panel.tsx`

**Files:**
- Modify: `src/components/admin/voucher-redemption-panel.tsx`

- [ ] **Step 1: State seleksi tanpa string kosong**

Ganti `useState<Record<string, string>>` menjadi `Record<string, string | undefined>` atau simpan hanya id yang dipilih:

```tsx
const [selections, setSelections] = useState<Record<string, string | undefined>>({});
```

Pada redeem, tetap validasi:

```tsx
const menuItemId = selections[ticketId];
if (!menuItemId) { ... }
```

- [ ] **Step 2: Opsi dari `menuItems`**

```tsx
const options = React.useMemo(
  () =>
    menuItems.map((m) => ({
      value: m.id,
      label: `${m.name} — ${idr(m.price)}`,
      keywords: `${m.name} ${m.price}`,
    })),
  [menuItems],
);
```

- [ ] **Step 3: Render `EntityCombobox` per tiket**

```tsx
<EntityCombobox
  disabled={isPending}
  placeholder="Pilih menu…"
  value={selections[ticket.id] ?? null}
  onValueChange={(next) =>
    setSelections((prev) => ({ ...prev, [ticket.id]: next ?? undefined }))
  }
  options={options}
/>
```

- [ ] **Step 4: `pnpm lint && pnpm test` + commit**

```bash
git add src/components/admin/voucher-redemption-panel.tsx
git commit -m "feat(admin): EntityCombobox for voucher menu redemption"
```

---

### Task 5: `management-member-form-dialog.tsx` — tautan anggota

**Files:**
- Modify: `src/components/admin/management-member-form-dialog.tsx`

- [ ] **Step 1: Opsi sentinel + anggota**

Asumsikan konstanta `NO_LINK` string sudah ada. Bangun:

```tsx
const masterMemberOptions = React.useMemo(
  () => [
    { value: NO_LINK, label: "Tidak ditautkan", keywords: "tidak" },
    ...availableMasterMembers.map((m) => ({
      value: m.id,
      label: `${m.memberNumber} — ${m.fullName}`,
      keywords: `${m.memberNumber} ${m.fullName}`,
    })),
  ],
  [availableMasterMembers],
);
```

- [ ] **Step 2: Ganti `Controller` untuk `masterMemberId`**

```tsx
<Controller
  control={form.control}
  name="masterMemberId"
  render={({ field }) => (
    <EntityCombobox
      id="mm-master-member"
      disabled={isPending}
      placeholder="Tidak ditautkan"
      value={field.value ?? NO_LINK}
      onValueChange={(next) => {
        if (next === null) return;
        field.onChange(next === NO_LINK ? null : next);
      }}
      options={masterMemberOptions}
      aria-invalid={Boolean(form.formState.errors.masterMemberId)}
    />
  )}
/>
```

Jika schema mengharuskan `null` di DB untuk "tidak ditautkan", pastikan transform di submit tidak mengubah `NO_LINK` menjadi id.

- [ ] **Step 3: Lint / test / commit**

```bash
git add src/components/admin/management-member-form-dialog.tsx
git commit -m "feat(admin): EntityCombobox for management member master link"
```

---

### Task 6: `management-assignment-form-dialog.tsx`

**Files:**
- Modify: `src/components/admin/management-assignment-form-dialog.tsx`

- [ ] **Step 1: Opsi pengurus**

```tsx
const memberOptions = React.useMemo(
  () =>
    availableMembers.map((m) => ({
      value: m.id,
      label: `${m.fullName} (${m.publicCode})`,
      keywords: `${m.fullName} ${m.publicCode}`,
    })),
  [availableMembers],
);

const roleOptions = React.useMemo(
  () =>
    availableRoles.map((r) => ({
      value: r.id,
      label: r.title,
      keywords: r.title,
    })),
  [availableRoles],
);
```

- [ ] **Step 2: Ganti Select pengurus (mode create)**

```tsx
<EntityCombobox
  id="assign-member"
  disabled={isPending}
  placeholder="Pilih pengurus…"
  value={field.value}
  onValueChange={(next) => {
    if (next === null) return;
    field.onChange(next);
  }}
  options={memberOptions}
  aria-invalid={fieldState.invalid}
  className="min-w-0"
/>
```

- [ ] **Step 3 (opsional tetapi disarankan): Ganti Select jabatan** dengan pola yang sama memakai `roleOptions`.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/management-assignment-form-dialog.tsx
git commit -m "feat(admin): EntityCombobox for management assignment picks"
```

---

### Task 7: `management-role-form-dialog.tsx` — jabatan induk

**Files:**
- Modify: `src/components/admin/management-role-form-dialog.tsx`

- [ ] **Step 1: Opsi dengan sentinel `ROLE_PARENT_NONE`**

```tsx
const parentRoleOptions = React.useMemo(
  () => [
    {
      value: ROLE_PARENT_NONE,
      label: "— Tidak ada induk —",
      keywords: "induk",
    },
    ...allRoles
      .filter((r) => r.id !== role?.id)
      .map((r) => ({
        value: r.id,
        label: r.title,
        keywords: r.title,
      })),
  ],
  [allRoles, role?.id],
);
```

- [ ] **Step 2: Controller `parentRoleId`**

```tsx
<EntityCombobox
  id="role-parent"
  disabled={isPending}
  placeholder="— Tidak ada induk —"
  value={field.value ?? ROLE_PARENT_NONE}
  onValueChange={(next) => {
    if (next === null) return;
    field.onChange(next);
  }}
  options={parentRoleOptions}
/>
```

Sesuaikan jika backend mengharuskan `null` daripada sentinel — sama seperti pola Select lama (`field.onChange` dengan sentinel).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/management-role-form-dialog.tsx
git commit -m "feat(admin): EntityCombobox for parent role picker"
```

---

## Verifikasi akhir

- [ ] Manual: buka `/admin/events/.../edit`, pilih venue/PIC/rekening — trigger menampilkan label, bukan UUID.
- [ ] Manual: inbox registration → voucher panel — pilih menu, label + harga tetap terlihat.
- [ ] Manual: kepengurusan → dialog pengurus & jabatan — nama/kode/title terlihat.
- [ ] `pnpm lint` dan `pnpm test` hijau di root repo.

---

## Self-review (checklist skill)

**1. Spec coverage:** Migrasi untuk pemilih kompleks berbasis ID + tampilan label + (implisit) pencarian — Task 2–7. Enum/filter URL tidak dimasukkan (disengaja).

**2. Placeholder scan:** Tidak memakai TBD/TODO untuk logika inti.

**3. Type consistency:** `EntityComboboxOptionRow` sama di util dan props; sentinel string mengikuti konstanta yang sudah ada per file (`NO_LINK`, `ROLE_PARENT_NONE`).

---

Plan complete and saved to `docs/superpowers/plans/2026-05-04-select-to-combobox-entity-pickers.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration (REQUIRED SUB-SKILL: superpowers:subagent-driven-development).

**2. Inline Execution** — run tasks in this session with executing-plans checkpoints (REQUIRED SUB-SKILL: superpowers:executing-plans).

**Which approach?**
