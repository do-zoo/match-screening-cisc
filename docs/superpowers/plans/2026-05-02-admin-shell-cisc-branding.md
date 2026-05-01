# Admin shell CISC branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menerapkan identitas visual CISC pada kulit admin (`AdminAppShell`, mobile sheet, mark merek) dan menyelaraskan ringan krom jalur event (breadcrumb, subnav mobile, wrapper layout, chip Inbox/Laporan di sidebar desktop) sesuai spek [2026-05-02-admin-shell-cisc-branding-design.md](../specs/2026-05-02-admin-shell-cisc-branding-design.md), tanpa mengubah routing, auth, `deriveGlobalSidebarNav`, atau tema publik global.

**Architecture:** Komponen tetap client di `src/components/admin/*`. Satu modul murni kecil untuk pola pathname breadcrumb (diuji Vitest). Satu modul berbagi kelas Tailwind untuk link nav sidebar agar `AdminAppShell` dan `AdminEventSidebarBlock` tidak drift. Mark merek menjadi komponen kecil `AdminBrandMark` (fallback geometris; siap diganti `next/image` nanti). Wrapper `data-admin-shell` pada akar shell dan `data-admin-event-chrome` pada layout event untuk scope dokumentasi / CSS masa depan — **tanpa** mengubah nilai `:root` di `globals.css` (variabel `--sidebar-*` sudah ada).

**Tech stack:** Next.js App Router, React, Tailwind CSS v4, shadcn/ui (`Button`, `Sheet`), Lucide React, Better Auth client, Vitest (node).

---

## File map (siapa mengubah apa)

| File | Tanggung jawab |
|------|----------------|
| `src/lib/admin/event-inbox-detail-path.ts` *(baru)* | Fungsi murni `pathsMatchRegistrationDetail` (dipindah dari breadcrumbs). |
| `src/lib/admin/event-inbox-detail-path.test.ts` *(baru)* | Tes pathname untuk detail registrasi vs inbox list. |
| `src/components/admin/admin-shell-nav-styles.ts` *(baru)* | `adminShellNavLinkClass(active)` dipakai shell global + chip acara sidebar. |
| `src/components/admin/admin-brand-mark.tsx` *(baru)* | Fallback mark + judul "CISC Admin" (bukan logo file). |
| `src/components/admin/admin-app-shell.tsx` | `data-admin-shell`, sidebar `bg-sidebar`, nav + ikon Lucide, sheet/mobile selaras. |
| `src/components/admin/admin-event-sidebar-block.tsx` | Pakai `adminShellNavLinkClass`; border atas selaras `sidebar-border`. |
| `src/components/admin/admin-event-breadcrumbs.tsx` | Impor helper path; poles visual link/separator/current. |
| `src/components/admin/admin-event-subnav.tsx` | Pill aktif/nonaktif selaras aksen `sidebar-accent` / outline. |
| `src/app/admin/events/[eventId]/layout.tsx` | Wrapper `data-admin-event-chrome` + separator halus di blok breadcrumb. |

Tidak menyentuh `src/app/(public)/*`, `src/app/layout.tsx` metadata, atau `globals.css` kecuali ada regresi tak terduga (tidak diharapkan).

---

### Task 1: Ekstrak matcher pathname breadcrumb + tes (TDD)

**Files:**
- Create: `src/lib/admin/event-inbox-detail-path.ts`
- Create: `src/lib/admin/event-inbox-detail-path.test.ts`
- Modify: `src/components/admin/admin-event-breadcrumbs.tsx` (hapus fungsi lokal, impor dari lib)

- [ ] **Step 1: Buat berkas tes yang mengimpor modul belum ada (gagal)**

Buat `src/lib/admin/event-inbox-detail-path.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { pathsMatchRegistrationDetail } from "@/lib/admin/event-inbox-detail-path";

describe("pathsMatchRegistrationDetail", () => {
  const eventId = "evt_123";

  it("returns false for exact inbox list path", () => {
    expect(
      pathsMatchRegistrationDetail(`/admin/events/${eventId}/inbox`, eventId),
    ).toBe(false);
  });

  it("returns true for registration detail under inbox", () => {
    expect(
      pathsMatchRegistrationDetail(
        `/admin/events/${eventId}/inbox/reg_abc`,
        eventId,
      ),
    ).toBe(true);
  });

  it("returns false for unrelated path", () => {
    expect(
      pathsMatchRegistrationDetail(`/admin/events/${eventId}/report`, eventId),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan Vitest — harus gagal impor**

Run (dari root repo, dengan Node 24 aktif per `AGENTS.md`):

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/admin/event-inbox-detail-path.test.ts
```

Expected: FAIL (cannot resolve module atau no export).

- [ ] **Step 3: Implementasi minimal**

Buat `src/lib/admin/event-inbox-detail-path.ts`:

```typescript
/** True when pathname is a registration detail under event inbox (not the inbox list). */
export function pathsMatchRegistrationDetail(
  pathname: string | null,
  eventId: string,
): boolean {
  if (!pathname) return false;
  if (pathname === `/admin/events/${eventId}/inbox`) return false;
  const prefix = `/admin/events/${eventId}/inbox/`;
  return pathname.startsWith(prefix) && pathname.length > prefix.length;
}
```

Di `src/components/admin/admin-event-breadcrumbs.tsx`, hapus definisi fungsi `pathsMatchRegistrationDetail` baris 8–16 dan tambahkan:

```typescript
import { pathsMatchRegistrationDetail } from "@/lib/admin/event-inbox-detail-path";
```

Panggilan `pathsMatchRegistrationDetail(pathname ?? null, eventId)` tetap sama.

- [ ] **Step 4: Jalankan Vitest — harus lulus**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/admin/event-inbox-detail-path.test.ts
```

Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/event-inbox-detail-path.ts src/lib/admin/event-inbox-detail-path.test.ts src/components/admin/admin-event-breadcrumbs.tsx
git commit -m "refactor(admin): extract inbox detail path matcher for tests"
```

---

### Task 2: Kelas nav sidebar bersama

**Files:**
- Create: `src/components/admin/admin-shell-nav-styles.ts`

- [ ] **Step 1: Tambahkan helper kelas**

Buat `src/components/admin/admin-shell-nav-styles.ts`:

```typescript
import { cn } from "@/lib/utils";

/** Shared nav row styles: desktop global nav + desktop event Inbox/Laporan chips. */
export function adminShellNavLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/admin-shell-nav-styles.ts
git commit -m "feat(admin): shared sidebar nav link classes for shell consistency"
```

---

### Task 3: Komponen AdminBrandMark

**Files:**
- Create: `src/components/admin/admin-brand-mark.tsx`

- [ ] **Step 1: Implementasi mark fallback**

Buat `src/components/admin/admin-brand-mark.tsx`:

```tsx
export function AdminBrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground shadow-sm"
        aria-hidden
      >
        C
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
          CISC Admin
        </p>
        <p className="text-xs text-sidebar-foreground/70">Panel PIC</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/admin-brand-mark.tsx
git commit -m "feat(admin): brand mark block for admin shell"
```

---

### Task 4: Re-skin AdminAppShell

**Files:**
- Modify: `src/components/admin/admin-app-shell.tsx`

- [ ] **Step 1: Ganti isi berkas** dengan versi di bawah (sesuaikan impor jika urutan lint memaksa).

Ganti seluruh isi `admin-app-shell.tsx` dengan:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import {
  CalendarDays,
  Home,
  MenuIcon,
  Settings,
  Users,
} from "lucide-react";

import { AdminBrandMark } from "@/components/admin/admin-brand-mark";
import { AdminEventSidebarBlock } from "@/components/admin/admin-event-sidebar-block";
import { adminShellNavLinkClass } from "@/components/admin/admin-shell-nav-styles";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { GlobalSidebarNav } from "@/lib/admin/global-nav-flags";
import { cn } from "@/lib/utils";

const authClient = createAuthClient();

function AdminNavLinks({
  navFlags,
  className,
  onNavigate,
}: {
  navFlags: GlobalSidebarNav;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const acaraExact = pathname === "/admin/events";
  const anggotaActive =
    pathname === "/admin/anggota" || pathname.startsWith("/admin/anggota/");
  const pengaturanActive =
    pathname === "/admin/pengaturan" ||
    pathname.startsWith("/admin/pengaturan/");

  return (
    <nav
      aria-label="Navigasi admin"
      className={cn("flex flex-col gap-1", className)}
    >
      <Link
        href="/admin?tab=active"
        data-active={pathname === "/admin" ? "" : undefined}
        onClick={onNavigate}
        className={adminShellNavLinkClass(pathname === "/admin")}
      >
        <Home className="size-4 shrink-0 opacity-80" aria-hidden />
        Beranda
      </Link>
      {navFlags.acara ? (
        <Link
          href="/admin/events"
          onClick={onNavigate}
          className={adminShellNavLinkClass(acaraExact)}
        >
          <CalendarDays className="size-4 shrink-0 opacity-80" aria-hidden />
          Acara
        </Link>
      ) : null}
      {navFlags.anggota ? (
        <Link
          href="/admin/anggota"
          onClick={onNavigate}
          className={adminShellNavLinkClass(anggotaActive)}
        >
          <Users className="size-4 shrink-0 opacity-80" aria-hidden />
          Anggota
        </Link>
      ) : null}
      {navFlags.pengaturan ? (
        <Link
          href="/admin/pengaturan"
          onClick={onNavigate}
          className={adminShellNavLinkClass(pengaturanActive)}
        >
          <Settings className="size-4 shrink-0 opacity-80" aria-hidden />
          Pengaturan
        </Link>
      ) : null}
    </nav>
  );
}

function AdminSignOutForm({ onDone }: { onDone?: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-auto w-full justify-center border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={async () => {
        await authClient.signOut();
        onDone?.();
        window.location.href = "/admin/sign-in";
      }}
    >
      Keluar
    </Button>
  );
}

export function AdminAppShell({
  navFlags,
  userEmail,
  children,
}: {
  navFlags: GlobalSidebarNav;
  userEmail: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      data-admin-shell
      className="flex min-h-[100dvh] w-full flex-col bg-muted/40 lg:flex-row"
    >
      <aside
        aria-label="Menu admin utama"
        className="sticky top-0 z-40 hidden min-h-[100dvh] w-[min(260px,100%)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex"
      >
        <div className="flex flex-1 flex-col gap-6 p-4">
          <div className="space-y-3">
            <AdminBrandMark />
            {userEmail ? (
              <p
                className="truncate px-0.5 text-xs text-sidebar-foreground/70"
                title={userEmail}
              >
                {userEmail}
              </p>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <AdminNavLinks navFlags={navFlags} className="shrink-0" />
            <AdminEventSidebarBlock />
          </div>
          <AdminSignOutForm />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col" data-admin-content>
        <header className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label="Menu admin"
                />
              }
            >
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[min(100%,280px)] flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
                <SheetTitle className="text-left text-sidebar-foreground">
                  Menu admin
                </SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4">
                <div className="space-y-1">
                  <AdminBrandMark />
                  {userEmail ? (
                    <p
                      className="truncate text-xs text-sidebar-foreground/70"
                      title={userEmail}
                    >
                      {userEmail}
                    </p>
                  ) : null}
                </div>
                <AdminNavLinks
                  navFlags={navFlags}
                  onNavigate={() => {
                    setMobileOpen(false);
                  }}
                />
                <div className="mt-auto border-t border-sidebar-border pt-4">
                  <AdminSignOutForm
                    onDone={() => {
                      setMobileOpen(false);
                    }}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-sidebar-foreground/70">PIC</p>
            {userEmail ? (
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {userEmail}
              </p>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `pnpm lint` pada berkas yang disentuh**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm eslint src/components/admin/admin-app-shell.tsx --max-warnings 0
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-app-shell.tsx
git commit -m "feat(admin): CISC-branded app shell sidebar and mobile sheet"
```

---

### Task 5: Selaraskan AdminEventSidebarBlock

**Files:**
- Modify: `src/components/admin/admin-event-sidebar-block.tsx`

- [ ] **Step 1: Ganti `navChipClass` dengan `adminShellNavLinkClass`**

Hapus fungsi `navChipClass` dan impor:

```typescript
import { adminShellNavLinkClass } from "@/components/admin/admin-shell-nav-styles";
```

Ganti pemanggilan `navChipClass(...)` menjadi `adminShellNavLinkClass(...)`.

Ubah wrapper atas dari `border-border` ke `border-sidebar-border`:

```tsx
<div className="space-y-2 border-t border-sidebar-border pt-4">
```

Label section "Acara" boleh tetap `text-muted-foreground` atau diseragamkan ke `text-sidebar-foreground/70` — pilih yang kontras masih terbaca di atas `bg-sidebar`.

- [ ] **Step 2: Lint + commit**

```bash
pnpm eslint src/components/admin/admin-event-sidebar-block.tsx --max-warnings 0
```

```bash
git add src/components/admin/admin-event-sidebar-block.tsx
git commit -m "style(admin): align event sidebar chips with shell nav"
```

---

### Task 6: Event layout + breadcrumb + subnav

**Files:**
- Modify: `src/app/admin/events/[eventId]/layout.tsx`
- Modify: `src/components/admin/admin-event-breadcrumbs.tsx`
- Modify: `src/components/admin/admin-event-subnav.tsx`

- [ ] **Step 1: Layout event — wrapper + separator**

Di `src/app/admin/events/[eventId]/layout.tsx`, bungkus return dengan outer div:

```tsx
return (
  <div data-admin-event-chrome className="flex min-h-0 flex-1 flex-col">
    {breadcrumbTitle ? (
      <div className="mx-auto w-full max-w-6xl shrink-0 border-b border-border/60 bg-muted/20 px-6 pb-3 pt-6 lg:pt-10">
        <AdminEventBreadcrumbs eventId={eventId} title={breadcrumbTitle} />
        <AdminEventSubnav eventId={eventId} />
      </div>
    ) : null}
    {children}
  </div>
);
```

- [ ] **Step 2: Breadcrumb — gaya link dan separator**

Di `admin-event-breadcrumbs.tsx`, dalam `<ol>`, perbarui kelas:

```tsx
<ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
```

menjadi:

```tsx
<ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground/90">
```

Untuk `Link` non-current:

```tsx
className={cn(
  "max-w-[12rem] truncate font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline md:max-w-md",
)}
```

Untuk `span` current:

```tsx
className={cn(
  "max-w-[14rem] truncate font-semibold text-foreground md:max-w-lg",
  c.current && "text-foreground",
)}
```

Separator `›` tetap; boleh `text-muted-foreground/50`.

- [ ] **Step 3: Subnav — pill selaras aksen sidebar**

Di `admin-event-subnav.tsx`, impor `cn` dan ganti `className` tiap `Link`:

```tsx
import { cn } from "@/lib/utils";
```

```tsx
const basePill =
  "rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const activePill =
  "border-transparent bg-sidebar-accent text-sidebar-accent-foreground";

<Link
  href={`/admin/events/${eventId}/inbox`}
  aria-current={isInbox && !isReport ? "page" : undefined}
  className={cn(
    basePill,
    isInbox && !isReport ? activePill : "text-muted-foreground hover:bg-muted",
  )}
>
  Inbox
</Link>
<Link
  href={`/admin/events/${eventId}/report`}
  aria-current={isReport ? "page" : undefined}
  className={cn(
    basePill,
    isReport ? activePill : "text-muted-foreground hover:bg-muted",
  )}
>
  Laporan
</Link>
```

Hapus impor `buttonVariants` jika tidak terpakai.

- [ ] **Step 4: Lint tiga berkas + commit**

```bash
pnpm eslint src/app/admin/events/\[eventId\]/layout.tsx src/components/admin/admin-event-breadcrumbs.tsx src/components/admin/admin-event-subnav.tsx --max-warnings 0
```

```bash
git add src/app/admin/events/\[eventId\]/layout.tsx src/components/admin/admin-event-breadcrumbs.tsx src/components/admin/admin-event-subnav.tsx
git commit -m "style(admin): event chrome strip aligned with shell branding"
```

---

### Task 7: Verifikasi akhir (seluruh suite + build + smoke manual)

- [ ] **Step 1: Vitest**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: semua tes lulus.

- [ ] **Step 2: ESLint proyek**

```bash
pnpm lint
```

Expected: exit 0.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: `Compiled successfully` / Next build selesai (butuh env valid untuk Prisma; jika build lokal gagal karena env, catat di PR dan minimal jalankan `pnpm lint` + `pnpm test`).

- [ ] **Step 4: Smoke manual (checklist)**

1. Login admin → `/admin`: sidebar tampil (≥lg) dengan ikon + mark; klik tiap item yang terlihat sesuai role.
2. Perkecil jendela &lt; lg: buka sheet, navigasi + Keluar.
3. Buka `/admin/events/{id}/inbox` dan `/report`: breadcrumb + pill mobile; desktop sidebar block Inbox/Laporan aktif cocok.
4. Buka detail registrasi (path `/inbox/{registrationId}`): crumb "Detail" current.
5. Tab publik `/` dan satu `/events/{slug}`: tidak ada perubahan warna mencolok dari sebelum merge (regresi tema global).

- [ ] **Step 5: Commit final hanya jika ada perbaikan dari review**

Jika tidak ada diff tambahan, tidak perlu commit kosong.

---

## Spec coverage (self-review)

| Bagian spek | Task |
|-------------|------|
| §2.1 `AdminAppShell` branding, ikon, sidebar semantic, mobile, `data-admin-shell` | Task 3–4 |
| §4.2 logo slot / fallback | Task 3 (`AdminBrandMark`) |
| §4.3 nav ikon + aktif + fokus | Task 2 + 3 |
| §2.1 event layout + breadcrumb + subnav | Task 6 |
| §4.4 event chrome | Task 5–6 |
| §5 lebar sidebar ≤260px | Task 3 `w-[min(260px,100%)]` |
| §6 a11y landmarks / truncate email | Terjaga di Task 3 |
| §8 publik tidak drift | Task 7 smoke — tidak edit `(public)` |
| §9 hindari `:root` global | Tidak ada task edit `globals.css` |

## Placeholder scan

Tidak ada TBD/TODO/`implement later`/langkah tanpa perintah atau kode konkret dalam dokumen ini.

## Type consistency

`pathsMatchRegistrationDetail` dua argumen `(pathname, eventId)` digunakan konsisten di lib + breadcrumbs import.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-admin-shell-cisc-branding.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch agen baru per task, review antar task, iterasi cepat.

**2. Inline Execution** — jalankan task di sesi ini dengan checkpoint review berkala.

Which approach?
