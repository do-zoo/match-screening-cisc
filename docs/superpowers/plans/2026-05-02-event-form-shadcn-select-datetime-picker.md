# Event Admin Form: Shadcn Select + Date Time Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti semua `<select>` native di form admin acara ke komponen Select (shadcn / Base UI), dan ganti kolom `startAtIso` / `endAtIso` dari input teks ISO mentah ke Date Time Picker (kalender + input waktu) yang tetap menulis string ISO ke payload Zod/server.

**Architecture:** Tambah fungsi murni untuk mengonversi antara string ISO (timezone disimpan sebagai UTC di server, diedit di zona waktu lokal browser) dan pasangan (hari kalender lokal + `HH:mm`). Tambah satu komponen klien `DateTimePicker` berbasis `Popover` + `Calendar` + `<Input type="time" />`. Di `event-admin-form.tsx`, bungkus picker dengan `Controller`; untuk enum dan PIC/bank pakai pola `Select` yang sama seperti `voucher-redemption-panel.tsx` / `member-validation-panel.tsx`. Tidak mengubah `admin-event-form-schema.ts` atau `admin-events.ts` selama serialized string tetap `Date`-parseable oleh `Date.parse` (ISO 8601).

**Tech Stack:** React 19, react-hook-form `Controller`, shadcn `select`/`calendar`/`popover` (`src/components/ui/`, Base UI primitives), `date-fns` (`startOfDay`, `setHours`, `setMinutes`, `format`, locale `date-fns/locale/id`), `react-day-picker` 9.x, Vitest untuk fungsi murni.

---

## Prerequisites

Komponen UI berikut harus ada di repo (jika masih berstatus untracked, commit dulu bersama tugas ini):

| File | Peran |
|------|------|
| `src/components/ui/select.tsx` | Select shadcn (sudah dipakai admin lain) |
| `src/components/ui/calendar.tsx` | DayPicker styling |
| `src/components/ui/popover.tsx` | Anchor popup kalender |

---

## Inventaris (hasil pencarian `src/`)

| Lokasi | Temuan |
|--------|--------|
| `src/components/admin/forms/event-admin-form.tsx` | **Satu-satunya** file dengan `<select>` (6 lokasi): `status`, `pricingSource`, `menuMode`, `menuSelection`, `picMasterMemberId`, `bankAccountId` |
| Sama file | `startAtIso`, `endAtIso` pakai `<Input {...register(...)}>` teks ISO (bukan `type="date"`) |
| Form publik | Tidak ada `<select>` atau `type="date"` |

Tidak ada field **tanggal-saja** (tanpa jam) yang perlu Date Picker terpisah; keduanya waktu lengkap → satu pola **Date Time Picker** untuk keduanya.

---

## File Map

| Action | File | Tanggung jawab |
|--------|------|----------------|
| **Create** | `src/lib/datetime/local-iso-datetime.ts` | Parse/format ISO ↔ hari lokal + `HH:mm` (tanpa DOM) |
| **Create** | `src/lib/datetime/local-iso-datetime.test.ts` | Vitest untuk fungsi di atas |
| **Create** | `src/components/ui/datetime-picker.tsx` | `"use client"` — Popover + Calendar + input waktu; label tombol bahasa Indonesia |
| **Modify** | `src/components/admin/forms/event-admin-form.tsx` | Select untuk 6 field; Controller + DateTimePicker untuk jadwal; impor baru |

---

### Task 1: Fungsi murni `local-iso-datetime`

**Files:**
- Create: `src/lib/datetime/local-iso-datetime.ts`
- Create: `src/lib/datetime/local-iso-datetime.test.ts`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `src/lib/datetime/local-iso-datetime.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  calendarDayAndTimeToIso,
  isoStringToCalendarAndTime,
} from "./local-iso-datetime";

describe("isoStringToCalendarAndTime", () => {
  it("returns local calendar day and HH:mm for a valid ISO string", () => {
    const iso = "2026-07-04T06:30:00.000Z";
    const got = isoStringToCalendarAndTime(iso);
    expect(got).not.toBeNull();
    expect(got!.hhmm).toMatch(/^\d{2}:\d{2}$/);
    const roundTrip = calendarDayAndTimeToIso(got!.day, got!.hhmm);
    expect(roundTrip).not.toBeNull();
    expect(new Date(roundTrip!).getTime()).toBe(new Date(iso).getTime());
  });

  it("returns null for non-parseable string", () => {
    expect(isoStringToCalendarAndTime("")).toBeNull();
    expect(isoStringToCalendarAndTime("bukan-waktu")).toBeNull();
  });
});

describe("calendarDayAndTimeToIso", () => {
  it("returns null for invalid time token", () => {
    expect(calendarDayAndTimeToIso(new Date(), "99:qq")).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan tes — harus gagal**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/datetime/local-iso-datetime.test.ts
```

Expected: gagal dengan modul tidak ditemukan / fungsi tidak terdefinisi.

- [ ] **Step 3: Implementasi minimal**

Buat `src/lib/datetime/local-iso-datetime.ts`:

```typescript
import { setHours, setMinutes, startOfDay } from "date-fns";

/** Parse ISO; derive local-calendar midnight + HH:mm untuk editor. */
export function isoStringToCalendarAndTime(
  iso: string,
): { day: Date; hhmm: string } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const day = startOfDay(d);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return { day, hhmm: `${hh}:${mm}` };
}

const HH_MM = /^(\d{1,2}):(\d{2})$/;

/** Bangun UTC ISO dari hari kalender (lokal) + waktu HH:mm (lokal). */
export function calendarDayAndTimeToIso(
  day: Date,
  hhmm: string,
): string | null {
  const m = hhmm.trim().match(HH_MM);
  if (!m) return null;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  if (!Number.isInteger(mins) || mins < 0 || mins > 59) return null;
  const atDay = startOfDay(day);
  const withClock = setMinutes(setHours(atDay, h), mins);
  return withClock.toISOString();
}
```

- [ ] **Step 4: Jalankan tes — harus lulus**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/datetime/local-iso-datetime.test.ts
```

Expected: semua tes `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/datetime/local-iso-datetime.ts src/lib/datetime/local-iso-datetime.test.ts
git commit -m "feat: helpers for ISO datetime local calendar editing"
```

---

### Task 2: Komponen `DateTimePicker`

**Files:**
- Create: `src/components/ui/datetime-picker.tsx`

- [ ] **Step 1: Buat file lengkap**

```tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  calendarDayAndTimeToIso,
  isoStringToCalendarAndTime,
} from "@/lib/datetime/local-iso-datetime";

export type DateTimePickerProps = {
  value: string;
  onChange: (nextIso: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
};

export function DateTimePicker({
  value,
  onChange,
  disabled,
  id,
  "aria-invalid": ariaInvalid,
  placeholder = "Pilih tanggal & waktu",
}: DateTimePickerProps) {
  const parts = isoStringToCalendarAndTime(value);
  const selectedDay = parts?.day ?? undefined;
  const timeStr = parts?.hhmm ?? "09:00";

  function applyNewDay(day: Date | undefined) {
    if (!day) return;
    const iso = calendarDayAndTimeToIso(day, timeStr);
    if (iso) onChange(iso);
  }

  function applyNewTime(nextHhmm: string) {
    if (!selectedDay) return;
    const iso = calendarDayAndTimeToIso(selectedDay, nextHhmm);
    if (iso) onChange(iso);
  }

  const label = parts
    ? format(parts.day, "d MMMM yyyy, HH:mm", { locale: localeId })
    : placeholder;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Popover>
        <PopoverTrigger
          disabled={disabled}
          id={id}
          aria-invalid={ariaInvalid ?? false}
          render={
            <Button
              variant="outline"
              className="w-full justify-start font-normal sm:flex-1"
            />
          }
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className={cn(!parts && "text-muted-foreground")}>{label}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            locale={localeId}
            captionLayout="dropdown"
            selected={selectedDay}
            onSelect={(d) => applyNewDay(d)}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        step={60}
        disabled={disabled || !selectedDay}
        aria-invalid={ariaInvalid}
        value={selectedDay ? timeStr : ""}
        onChange={(e) => applyNewTime(e.target.value)}
        className="bg-background sm:w-[8.5rem]"
      />
    </div>
  );
}
```

Jika TypeScript untuk `PopoverTrigger` tidak menerima `render` seperti `DialogTrigger`, samakan pola dengan file UI Base UI projet ini (misalnya hanya `className` + anak)—atau konsultasikan tipe `@base-ui/react/popover` di `node_modules`; jangan mengubah perilaku aksesibilitas tombol pemicu.

- [ ] **Step 2: Cek ESLint untuk file baru**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm eslint src/components/ui/datetime-picker.tsx
```

Expected: exit code `0`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/datetime-picker.tsx
git commit -m "feat(ui): DateTime picker with calendar and local time input"
```

---

### Task 3: Migrasi `EventAdminForm` — Select + DateTimePicker

**Files:**
- Modify: `src/components/admin/forms/event-admin-form.tsx` (impor bagian atas, blok "Jadwal & lokasi" ~251–263, blok `<select>` 265–541)

- [ ] **Step 1: Tambah impor**

Di bagian impor `@/components`, tambahkan:

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/datetime-picker";
```

- [ ] **Step 2: Ganti kolom jadwal**

Ganti blok:

```tsx
<Field label="Mulai (ISO)">
  <Input {...form.register("startAtIso")} disabled={pending} />
</Field>
<Field label="Selesai (ISO)">
  <Input {...form.register("endAtIso")} disabled={pending} />
</Field>
```

menjadi:

```tsx
<Field label="Waktu mulai">
  <Controller
    control={form.control}
    name="startAtIso"
    render={({ field, fieldState }) => (
      <DateTimePicker
        value={field.value}
        onChange={field.onChange}
        disabled={pending}
        aria-invalid={fieldState.invalid}
      />
    )}
  />
</Field>
<Field label="Waktu selesai">
  <Controller
    control={form.control}
    name="endAtIso"
    render={({ field, fieldState }) => (
      <DateTimePicker
        value={field.value}
        onChange={field.onChange}
        disabled={pending}
        aria-invalid={fieldState.invalid}
      />
    )}
  />
</Field>
```

- [ ] **Step 3: `status` — Select + Controller**

Ganti `<Field label="Status acara">` + `<select {...form.register("status")}>…` dengan:

```tsx
<Field label="Status acara">
  <Controller
    control={form.control}
    name="status"
    render={({ field }) => (
      <Select
        value={field.value}
        onValueChange={(v) => field.onChange(v)}
        disabled={pending}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Draf</SelectItem>
          <SelectItem value="active">Aktif</SelectItem>
          <SelectItem value="finished">Selesai</SelectItem>
        </SelectContent>
      </Select>
    )}
  />
</Field>
```

- [ ] **Step 4: `pricingSource` — Select**

Ganti `<Field label="Sumber harga">` dan `<select value={pricingSource} …>` dengan:

```tsx
<Field label="Sumber harga">
  <Select
    value={pricingSource}
    onValueChange={(v) => {
      const next = v as AdminEventUpsertInput["pricingSource"];
      form.setValue("pricingSource", next, { shouldDirty: true });
      if (next === "global_default") pickCommitteePrices();
    }}
    disabled={pending}
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="global_default">Default komite</SelectItem>
      <SelectItem value="overridden">Override per acara</SelectItem>
    </SelectContent>
  </Select>
</Field>
```

- [ ] **Step 5: `menuMode` — Select**

Ganti `<Field label="Mode menu">` + `<select value={menuMode} …>` dengan:

```tsx
<Field label="Mode menu">
  <Select
    value={menuMode}
    onValueChange={(v) =>
      form.setValue("menuMode", v as AdminEventUpsertInput["menuMode"], {
        shouldDirty: true,
      })
    }
    disabled={pending || lockedMenuKeys.includes("menuMode")}
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="PRESELECT">Pilih menu di form</SelectItem>
      <SelectItem value="VOUCHER">Voucher</SelectItem>
    </SelectContent>
  </Select>
  {lockedMenuKeys.includes("menuMode") ? (
    <Muted>Terhubung pada pendaftar — tidak dapat diubah.</Muted>
  ) : null}
</Field>
```

- [ ] **Step 6: `menuSelection` — Select**

Ganti `<Field label="Pilihan menu">` + select terkait dengan:

```tsx
<Field label="Pilihan menu">
  <Select
    value={menuSelection}
    onValueChange={(v) =>
      form.setValue(
        "menuSelection",
        v as AdminEventUpsertInput["menuSelection"],
        { shouldDirty: true },
      )
    }
    disabled={pending || lockedMenuKeys.includes("menuSelection")}
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="SINGLE">Satu opsi per tiket</SelectItem>
      <SelectItem value="MULTI">Multi pilih per tiket</SelectItem>
    </SelectContent>
  </Select>
  {lockedMenuKeys.includes("menuSelection") ? (
    <Muted>Terhubung pada pendaftar — tidak dapat diubah.</Muted>
  ) : null}
</Field>
```

- [ ] **Step 7: `picMasterMemberId` — Select**

Ganti `<Field label="PIC utama">` + `<select value={picId} …>` dengan:

```tsx
<Field label="PIC utama">
  <Select
    value={picId}
    onValueChange={(next) => {
      form.setValue("picMasterMemberId", next, { shouldDirty: true });
      const first = props.banksByPic[next]?.[0]?.id ?? "";
      form.setValue("bankAccountId", first, { shouldDirty: true });
    }}
    disabled={pending}
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {props.picOptions.map((p) => (
        <SelectItem key={p.id} value={p.id}>
          {p.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</Field>
```

- [ ] **Step 8: `bankAccountId` — Select**

Ganti `<Field label="Rekening pembayaran">` + `<select value={bankAccountId} …>` dengan:

```tsx
<Field label="Rekening pembayaran">
  <Select
    value={bankAccountId}
    onValueChange={(v) =>
      form.setValue("bankAccountId", v, { shouldDirty: true })
    }
    disabled={pending || bankChoices.length === 0}
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {bankChoices.map((b) => (
        <SelectItem key={b.id} value={b.id}>
          {b.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  {bankChoices.length === 0 ? (
    <Muted>
      Tidak ada rekening aktif untuk PIC ini — tambahkan di pengaturan
      komite.
    </Muted>
  ) : null}
</Field>
```

Pastikan tidak ada sisa tag `<select` di file (cek dengan `rg '<select' src/components/admin/forms/event-admin-form.tsx`).

- [ ] **Step 9: Verifikasi**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test && pnpm build
```

Expected: `pnpm lint` dan `pnpm test` tanpa error; `pnpm build` sukses (butuh env DB/Blob sesuai proyek; jika build lokal gagal karena env, minimal `pnpm test` + `pnpm lint` wajib hijau).

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx
git commit -m "refactor(admin): event form uses shadcn Select and datetime picker"
```

---

## Self-review (checklist penulis rencana)

1. **Cakupan spek:** Migrasi seluruh native `<select>` di repo (`event-admin-form` saja); input jadwal ke Date **Time** Picker — terpenuhi.
2. **Placeholder:** Tidak ada TBD/`implement later`; kode konkret ada di tiap tugas utama.
3. **Konsistensi tipe:** Nilai Select string enum sama dengan `<option value="…">`; `pricingSource`, `menuMode`, `menuSelection` menggunakan cast ke `AdminEventUpsertInput[...]` seperti sebelumnya.

---

## Catatan perilaku produk

- **Zona waktu:** Konversi memakai **zona lokal mesin pengguna**. Nilai tetap dikirim sebagai ISO UTC seperti sebelumnya (`toISOString()`), sama dengan `edit/page.tsx` yang memuat `event.startAt.toISOString()`.
- **Tanpa tanggal yang valid:** Tombol kalender menampilkan placeholder; input jam nonaktif sampai hari dipilih; default jam pertama kali ialah `09:00` ketika ISO belum bisa diparse (misalnya data rusak)—setelah user memilih tanggal, kombinasi tersimpan.
- **`calendar.tsx` caption `dropdown`:** Membutuhkan `captionLayout="dropdown"` pada react-day-picker 9 seperti di styling shadcn; jika ada peringatan a11y, pertahankan opsi `"label"` hanya sebagai fallback dengan mengubah satu baris di `datetime-picker.tsx`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-event-form-shadcn-select-datetime-picker.md`. Dua opsi eksekusi:**

**1. Subagent-Driven (disarankan)** — dispatch subagent baru per task, review antar-task, iterasi cepat (**REQUIRED SUB-SKILL:** superpowers:subagent-driven-development)

**2. Inline Execution** — jalankan task di sessi ini dengan executing-plans, batch + checkpoint (**REQUIRED SUB-SKILL:** superpowers:executing-plans)

**Pilih pendekatan yang mana?**
