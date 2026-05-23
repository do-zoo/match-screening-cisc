# Mobile Subnav → Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the three mobile subnav menus (event branch, venue branch, committee settings) from the page content area into the mobile drawer (Sheet) in `AdminAppShell`, then remove the now-redundant inline pill/scroll navs.

**Architecture:** Each subnav component gains an `onNavigate` callback so its links can close the drawer on tap. The `AdminAppShell` mobile drawer gains three self-detecting context sections (event, venue, settings) that read `usePathname()` to decide whether to render. The mobile-only inline pill navs and the mobile portion of the settings aside are then removed.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui Sheet

---

## File Map

| File                                                 | Action | Purpose                                                    |
| ---------------------------------------------------- | ------ | ---------------------------------------------------------- |
| `src/components/admin/admin-event-sidebar-block.tsx` | Modify | Add `onNavigate` prop, thread to Link onClick              |
| `src/components/admin/admin-venue-sidebar-block.tsx` | Modify | Add `onNavigate` prop, thread to Link onClick              |
| `src/components/admin/committee-settings-subnav.tsx` | Modify | Add `onNavigate` prop, simplify to single-direction layout |
| `src/components/admin/admin-app-shell.tsx`           | Modify | Add context blocks + settings section to mobile drawer     |
| `src/app/admin/events/[eventId]/layout.tsx`          | Modify | Remove `AdminEventSubnav`                                  |
| `src/app/admin/venues/[venueId]/layout.tsx`          | Modify | Remove `AdminVenueSubnav`                                  |
| `src/app/admin/settings/layout.tsx`                  | Modify | Hide settings aside on mobile (`hidden lg:block`)          |
| `src/components/admin/admin-event-subnav.tsx`        | Delete | Replaced by drawer context block                           |
| `src/components/admin/admin-venue-subnav.tsx`        | Delete | Replaced by drawer context block                           |

---

### Task 1: Add `onNavigate` to `AdminEventSidebarBlock`

**Files:**

- Modify: `src/components/admin/admin-event-sidebar-block.tsx`

The only substantive change is adding `onNavigate?: () => void` to both the inner `AdminEventSidebarBlockLoaded` and the outer `AdminEventSidebarBlock`, then passing `onClick={onNavigate}` to each `<Link>`. Also switch `EVENT_BRANCH_RE.exec(pathname)` → `pathname.match(EVENT_BRANCH_RE)` (same result for non-global regex, avoids hook false-positive).

- [ ] **Step 1: Replace the file**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Settings, Table2Icon, Users } from 'lucide-react'

import { adminShellNavIconClass, adminShellNavLinkClass } from '@/components/admin/admin-shell-nav-styles'

const EVENT_BRANCH_RE = /^\/admin\/events\/([^/]+)\/(?:registrants|report|edit)(?:\/|$)/

function AdminEventSidebarBlockLoaded({ eventId, onNavigate }: { eventId: string; onNavigate?: () => void }) {
  const pathname = usePathname()

  const isEditBranch = !!pathname && pathname === `/admin/events/${eventId}/edit`
  const isReportBranch =
    !!pathname &&
    (pathname === `/admin/events/${eventId}/report` || pathname.startsWith(`/admin/events/${eventId}/report/`))
  const listPath = `/admin/events/${eventId}/registrants`
  const isRegistrantsBranch = !!pathname && (pathname === listPath || pathname.startsWith(`${listPath}/`))

  const [title, setTitle] = useState<string | null>(null)
  const [canManageEventSettings, setCanManageEventSettings] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/admin/events/${eventId}/title`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        title?: string
        canManageEventSettings?: boolean
      }
      if (!cancelled) {
        setTitle(data.title ?? null)
        setCanManageEventSettings(Boolean(data.canManageEventSettings))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [eventId])

  return (
    <div className='border-t border-sidebar-border/70 pt-5'>
      <div className='rounded-xl bg-sidebar-accent/35 p-3.5 shadow-sm ring-1 ring-sidebar-border/45'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50'>Acara</p>
        {title ? (
          <p className='mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-sidebar-foreground' title={title}>
            {title}
          </p>
        ) : (
          <p className='mt-2 text-xs text-sidebar-foreground/45'>Memuat judul…</p>
        )}
        <nav aria-label='Peserta acara, laporan, dan pengaturan' className='mt-3 flex flex-col gap-0.5'>
          <Link
            href={listPath}
            onClick={onNavigate}
            className={adminShellNavLinkClass(isRegistrantsBranch && !isReportBranch && !isEditBranch)}
          >
            <Users
              className={adminShellNavIconClass(isRegistrantsBranch && !isReportBranch && !isEditBranch)}
              aria-hidden
            />
            Peserta Acara
          </Link>
          <Link
            href={`/admin/events/${eventId}/report`}
            onClick={onNavigate}
            className={adminShellNavLinkClass(isReportBranch && !isEditBranch)}
          >
            <Table2Icon className={adminShellNavIconClass(isReportBranch && !isEditBranch)} aria-hidden />
            Laporan
          </Link>
          {canManageEventSettings ? (
            <Link
              href={`/admin/events/${eventId}/edit`}
              onClick={onNavigate}
              className={adminShellNavLinkClass(isEditBranch)}
            >
              <Settings className={adminShellNavIconClass(isEditBranch)} aria-hidden />
              Pengaturan
            </Link>
          ) : null}
        </nav>
      </div>
    </div>
  )
}

export function AdminEventSidebarBlock({
  onNavigate,
}: {
  onNavigate?: () => void
} = {}) {
  const pathname = usePathname()
  const match = pathname ? pathname.match(EVENT_BRANCH_RE) : null
  const eventId = match?.[1] ?? null

  if (!eventId) return null

  return <AdminEventSidebarBlockLoaded key={eventId} eventId={eventId} onNavigate={onNavigate} />
}
```

- [ ] **Step 2: Type-check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-event-sidebar-block.tsx
git commit -m "feat(admin-shell): add onNavigate to AdminEventSidebarBlock"
```

---

### Task 2: Add `onNavigate` to `AdminVenueSidebarBlock`

**Files:**

- Modify: `src/components/admin/admin-venue-sidebar-block.tsx`

Same pattern as Task 1: add `onNavigate` prop to both inner and outer, thread to each Link onClick.

- [ ] **Step 1: Replace the file**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MapPin, UtensilsCrossed } from 'lucide-react'

import { adminShellNavIconClass, adminShellNavLinkClass } from '@/components/admin/admin-shell-nav-styles'

const VENUE_BRANCH_RE = /^\/admin\/venues\/([^/]+)\/(?:edit|menu)(?:\/|$)/

function AdminVenueSidebarBlockLoaded({ venueId, onNavigate }: { venueId: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const isEdit = !!pathname && pathname === `/admin/venues/${venueId}/edit`
  const isMenu = !!pathname && pathname === `/admin/venues/${venueId}/menu`

  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/admin/venues/${venueId}/label`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = (await res.json()) as { name?: string }
      if (!cancelled) setName(data.name ?? null)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [venueId])

  return (
    <div className='border-sidebar-border/70 border-t pt-5'>
      <div className='bg-sidebar-accent/35 ring-sidebar-border/45 rounded-xl p-3.5 shadow-sm ring-1'>
        <p className='text-sidebar-foreground/50 text-[11px] font-semibold tracking-[0.14em] uppercase'>Venue</p>
        {name ? (
          <p className='text-sidebar-foreground mt-2 line-clamp-2 text-[13px] leading-snug font-semibold' title={name}>
            {name}
          </p>
        ) : (
          <p className='text-sidebar-foreground/45 mt-2 text-xs'>Memuat nama…</p>
        )}
        <nav aria-label='Info venue dan menu' className='mt-3 flex flex-col gap-0.5'>
          <Link
            href={`/admin/venues/${venueId}/edit`}
            onClick={onNavigate}
            className={adminShellNavLinkClass(isEdit && !isMenu)}
          >
            <MapPin className={adminShellNavIconClass(isEdit && !isMenu)} aria-hidden />
            Info dasar
          </Link>
          <Link href={`/admin/venues/${venueId}/menu`} onClick={onNavigate} className={adminShellNavLinkClass(isMenu)}>
            <UtensilsCrossed className={adminShellNavIconClass(isMenu)} aria-hidden />
            Menu kanonik
          </Link>
        </nav>
      </div>
    </div>
  )
}

export function AdminVenueSidebarBlock({
  onNavigate,
}: {
  onNavigate?: () => void
} = {}) {
  const pathname = usePathname()
  const branchMatch = pathname ? pathname.match(VENUE_BRANCH_RE) : null
  const venueId = branchMatch?.[1] ?? null

  if (!venueId) return null

  return <AdminVenueSidebarBlockLoaded venueId={venueId} onNavigate={onNavigate} />
}
```

- [ ] **Step 2: Type-check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-venue-sidebar-block.tsx
git commit -m "feat(admin-shell): add onNavigate to AdminVenueSidebarBlock"
```

---

### Task 3: Add `onNavigate` to `CommitteeSettingsSubnav` and simplify its layout

**Files:**

- Modify: `src/components/admin/committee-settings-subnav.tsx`

Current `nav` className has `flex-row ... overflow-x-auto ... lg:flex-col` because it handles both mobile (horizontal scroll) and desktop (vertical). After this change the component renders identically in both locations (drawer and desktop aside) — always vertical. Simplify to `flex flex-col gap-1`.

- [ ] **Step 1: Replace the file**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export const COMMITTEE_SETTINGS_NAV = [
  { href: '/admin/settings', label: 'Ringkasan' },
  { href: '/admin/settings/committee', label: 'Komite & admin' },
  { href: '/admin/settings/whatsapp-templates', label: 'Template WhatsApp' },
  { href: '/admin/settings/branding', label: 'Branding' },
  { href: '/admin/settings/notifications', label: 'Notifikasi' },
  { href: '/admin/settings/operations', label: 'Operasional' },
  { href: '/admin/settings/security', label: 'Keamanan' },
] as const

export function CommitteeSettingsSubnav({
  onNavigate,
}: {
  onNavigate?: () => void
} = {}) {
  const pathname = usePathname()
  return (
    <nav aria-label='Submenu pengaturan' className='flex flex-col gap-1'>
      {COMMITTEE_SETTINGS_NAV.map(item => {
        const active =
          item.href === '/admin/settings'
            ? pathname === '/admin/settings'
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-active={active ? '' : undefined}
            className={cn(
              'shrink-0 rounded-md px-2 py-1.5 text-sm transition-colors',
              active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/committee-settings-subnav.tsx
git commit -m "feat(admin-shell): add onNavigate to CommitteeSettingsSubnav, simplify layout"
```

---

### Task 4: Update `AdminAppShell` — add context sections to the mobile drawer

**Files:**

- Modify: `src/components/admin/admin-app-shell.tsx`

Three changes:

1. Add a local `AdminSettingsDrawerSection` component that conditionally renders `CommitteeSettingsSubnav` when the current path starts with `/admin/settings`.
2. Import `CommitteeSettingsSubnav`.
3. In the mobile `SheetContent`, render `<AdminEventSidebarBlock>`, `<AdminVenueSidebarBlock>`, and `<AdminSettingsDrawerSection>` after `<AdminNavLinks>`, all wired to `closeMobile`.

- [ ] **Step 1: Replace the file**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, MapPin, MenuIcon, Settings, Users, UsersRound } from 'lucide-react'

import { AdminAccountMenu } from '@/components/admin/admin-account-menu'
import { AdminBrandMark } from '@/components/admin/admin-brand-mark'
import { AdminEventSidebarBlock } from '@/components/admin/admin-event-sidebar-block'
import { AdminVenueSidebarBlock } from '@/components/admin/admin-venue-sidebar-block'
import { CommitteeSettingsSubnav } from '@/components/admin/committee-settings-subnav'
import { adminShellNavIconClass, adminShellNavLinkClass } from '@/components/admin/admin-shell-nav-styles'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { GlobalSidebarNav } from '@/lib/admin/global-nav-flags'
import { cn } from '@/lib/utils'

function AdminNavLinks({
  navFlags,
  className,
  onNavigate,
}: {
  navFlags: GlobalSidebarNav
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const acaraExact = pathname === '/admin/events'
  const venuesActive = pathname === '/admin/venues' || pathname.startsWith('/admin/venues/')
  const membersActive = pathname === '/admin/members' || pathname.startsWith('/admin/members/')
  const managementActive = pathname === '/admin/management' || pathname.startsWith('/admin/management/')
  const settingsActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/')

  return (
    <nav aria-label='Navigasi admin' className={cn('flex flex-col gap-1.5', className)}>
      <Link
        href='/admin'
        data-active={pathname === '/admin' ? '' : undefined}
        onClick={onNavigate}
        className={adminShellNavLinkClass(pathname === '/admin')}
      >
        <Home className={adminShellNavIconClass(pathname === '/admin')} aria-hidden />
        Beranda
      </Link>
      {navFlags.acara ? (
        <Link href='/admin/events?tab=active' onClick={onNavigate} className={adminShellNavLinkClass(acaraExact)}>
          <CalendarDays className={adminShellNavIconClass(acaraExact)} aria-hidden />
          Acara
        </Link>
      ) : null}
      {navFlags.venues ? (
        <Link href='/admin/venues' onClick={onNavigate} className={adminShellNavLinkClass(venuesActive)}>
          <MapPin className={adminShellNavIconClass(venuesActive)} aria-hidden />
          Venue
        </Link>
      ) : null}
      {navFlags.members ? (
        <Link href='/admin/members' onClick={onNavigate} className={adminShellNavLinkClass(membersActive)}>
          <Users className={adminShellNavIconClass(membersActive)} aria-hidden />
          Anggota
        </Link>
      ) : null}
      {navFlags.management ? (
        <Link href='/admin/management' onClick={onNavigate} className={adminShellNavLinkClass(managementActive)}>
          <UsersRound className={adminShellNavIconClass(managementActive)} aria-hidden />
          Kepengurusan
        </Link>
      ) : null}
      {navFlags.settings ? (
        <Link href='/admin/settings' onClick={onNavigate} className={adminShellNavLinkClass(settingsActive)}>
          <Settings className={adminShellNavIconClass(settingsActive)} aria-hidden />
          Pengaturan
        </Link>
      ) : null}
    </nav>
  )
}

function AdminSettingsDrawerSection({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  if (!pathname?.startsWith('/admin/settings')) return null
  return (
    <div className='border-t border-sidebar-border/70 pt-5'>
      <div className='rounded-xl bg-sidebar-accent/35 p-3.5 shadow-sm ring-1 ring-sidebar-border/45'>
        <p className='mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50'>
          Pengaturan
        </p>
        <CommitteeSettingsSubnav onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export function AdminAppShell({
  navFlags,
  userEmail,
  displayName,
  children,
}: {
  navFlags: GlobalSidebarNav
  userEmail: string | null
  displayName: string | null
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  return (
    <div data-admin-shell className='flex min-h-[100dvh] w-full flex-col bg-muted/40 lg:flex-row lg:items-start'>
      <aside
        aria-label='Menu admin utama'
        className='sticky top-0 z-40 hidden w-[min(238px,100%)] shrink-0 border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-[inset_-1px_0_0_0_var(--sidebar-border)] lg:flex lg:max-h-[100dvh] lg:min-h-[100dvh] lg:flex-col lg:overflow-hidden lg:self-start'
      >
        <div className='flex min-h-0 w-full flex-1 flex-col px-3 pt-5 pb-4'>
          <div className='shrink-0'>
            <AdminBrandMark />
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain py-6'>
            <div className='flex flex-col gap-2'>
              <AdminNavLinks navFlags={navFlags} className='shrink-0' />
              <AdminEventSidebarBlock />
              <AdminVenueSidebarBlock />
            </div>
          </div>
          <div className='shrink-0 border-t border-sidebar-border/60 pt-4'>
            <AdminAccountMenu userEmail={userEmail} displayName={displayName} variant='sidebar' />
          </div>
        </div>
      </aside>

      <div className='flex min-w-0 flex-1 flex-col' data-admin-content>
        <header className='flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden'>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant='outline'
                  size='icon'
                  className='size-11 shrink-0 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  aria-label='Menu admin'
                />
              }
            >
              <MenuIcon className='size-5' />
            </SheetTrigger>
            <SheetContent
              side='left'
              className='flex w-[min(100%,280px)] flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground'
            >
              <SheetHeader className='border-b border-sidebar-border px-4 py-4 text-left'>
                <SheetTitle className='text-left text-sidebar-foreground'>Menu admin</SheetTitle>
              </SheetHeader>
              <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4'>
                <div className='space-y-1'>
                  <AdminBrandMark />
                </div>
                <AdminNavLinks navFlags={navFlags} onNavigate={closeMobile} />
                <AdminEventSidebarBlock onNavigate={closeMobile} />
                <AdminVenueSidebarBlock onNavigate={closeMobile} />
                <AdminSettingsDrawerSection onNavigate={closeMobile} />
              </div>
            </SheetContent>
          </Sheet>
          <div className='min-w-0 flex-1 space-y-0.5'>
            <p className='truncate text-xs text-sidebar-foreground/70'>PIC</p>
            <AdminAccountMenu userEmail={userEmail} displayName={displayName} />
          </div>
        </header>

        <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

Start the dev server (`pnpm dev`) and at a viewport narrower than 1024px:

- Navigate to any event branch (e.g. `/admin/events/<id>/registrants`)
- Tap the hamburger — confirm the "Acara" section appears in the drawer with Peserta Acara / Laporan / (Pengaturan if Owner/Admin), active link highlighted
- Navigate to any venue branch — confirm "Venue" section appears in the drawer
- Navigate to `/admin/settings` — confirm the "Pengaturan" section appears in the drawer with all 7 items
- Tapping any subnav link closes the drawer

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/admin-app-shell.tsx
git commit -m "feat(admin-shell): add event/venue/settings subnav to mobile drawer"
```

---

### Task 5: Remove `AdminEventSubnav` from the event branch layout

**Files:**

- Modify: `src/app/admin/events/[eventId]/layout.tsx`
- Delete: `src/components/admin/admin-event-subnav.tsx`

`hasOperationalOwnerParity` and `canManageEventSettings` are no longer needed here — the sidebar block fetches that flag itself via `/api/admin/events/[eventId]/title`.

- [ ] **Step 1: Replace the layout file**

```tsx
import { AdminEventBreadcrumbs } from '@/components/admin/admin-event-breadcrumbs'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { canVerifyEvent } from '@/lib/permissions/guards'

export default async function AdminEventBranchLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ eventId: string }>
}>) {
  const { eventId } = await params

  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)

  let breadcrumbTitle: string | null = null
  if (ctx && canVerifyEvent(ctx, eventId)) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    })
    breadcrumbTitle = event?.title ?? null
  }

  return (
    <div data-admin-event-chrome className='flex min-h-0 flex-1 flex-col'>
      {breadcrumbTitle ? (
        <div className='w-full shrink-0 border-b border-border/60 bg-muted/20'>
          <div className='mx-auto w-full max-w-6xl px-6 pb-3 pt-6 lg:pt-10'>
            <AdminEventBreadcrumbs eventId={eventId} title={breadcrumbTitle} />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/admin/admin-event-subnav.tsx
```

- [ ] **Step 3: Type-check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/events/\[eventId\]/layout.tsx
git commit -m "refactor(admin-shell): remove AdminEventSubnav — subnav now in mobile drawer"
```

---

### Task 6: Remove `AdminVenueSubnav` from the venue branch layout

**Files:**

- Modify: `src/app/admin/venues/[venueId]/layout.tsx`
- Delete: `src/components/admin/admin-venue-subnav.tsx`

- [ ] **Step 1: Replace the layout file**

```tsx
import { AdminVenueBreadcrumbs } from '@/components/admin/admin-venue-breadcrumbs'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'

export default async function AdminVenueBranchLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ venueId: string }>
}>) {
  const { venueId } = await params

  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)

  let breadcrumbName: string | null = null
  if (ctx && hasOperationalOwnerParity(ctx.role)) {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { name: true },
    })
    breadcrumbName = venue?.name ?? null
  }

  return (
    <div data-admin-venue-chrome className='flex min-h-0 flex-1 flex-col'>
      {breadcrumbName ? (
        <div className='border-border/60 bg-muted/20 w-full shrink-0 border-b'>
          <div className='mx-auto w-full max-w-6xl px-6 pb-3 pt-6 lg:pt-10'>
            <AdminVenueBreadcrumbs venueId={venueId} name={breadcrumbName} />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/admin/admin-venue-subnav.tsx
```

- [ ] **Step 3: Type-check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/venues/\[venueId\]/layout.tsx
git commit -m "refactor(admin-shell): remove AdminVenueSubnav — subnav now in mobile drawer"
```

---

### Task 7: Hide settings aside on mobile in the settings layout

**Files:**

- Modify: `src/app/admin/settings/layout.tsx`

The `CommitteeSettingsSubnav` is now in the mobile drawer. The settings `aside` should only appear on desktop. Change `lg:w-56 lg:shrink-0 lg:overflow-visible` → `hidden lg:block lg:w-56 lg:shrink-0 lg:overflow-visible`.

- [ ] **Step 1: Replace the layout file**

```tsx
import { notFound } from 'next/navigation'

import { CommitteeSettingsSubnav } from '@/components/admin/committee-settings-subnav'
import { requireAdminSession } from '@/lib/auth/session'
import { getAdminContext } from '@/lib/auth/admin-context'

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)
  if (!ctx) notFound()

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:flex-row lg:gap-10 lg:py-10'>
      <aside className='hidden lg:block lg:w-56 lg:shrink-0 lg:overflow-visible'>
        <CommitteeSettingsSubnav />
      </aside>
      <div className='min-w-0 flex-1'>{children}</div>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/layout.tsx
git commit -m "refactor(admin-shell): hide settings aside on mobile — subnav now in drawer"
```

---

### Task 8: Final verification

- [ ] **Step 1: Start dev server**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm dev
```

- [ ] **Step 2: Verify event branch on mobile (< 1024px viewport)**

Navigate to `/admin/events/<id>/registrants`:

- Page: no pill nav below breadcrumbs
- Drawer (hamburger): "Acara" block appears with Peserta Acara / Laporan / Pengaturan (Owner/Admin only); active link has accent background; tapping closes drawer

- [ ] **Step 3: Verify venue branch on mobile**

Navigate to `/admin/venues/<id>/edit`:

- Page: no pill nav below breadcrumbs
- Drawer: "Venue" block appears with Info dasar / Menu kanonik; active link highlighted; tapping closes drawer

- [ ] **Step 4: Verify settings on mobile**

Navigate to `/admin/settings`:

- Page: content takes full width (no horizontal scroll nav)
- Drawer: "Pengaturan" block appears with all 7 items (Ringkasan → Keamanan); active item highlighted; tapping closes drawer

- [ ] **Step 5: Verify desktop is unchanged (≥ 1024px)**

- Sidebar shows event/venue context blocks when on those branches
- Settings has vertical aside
- Hamburger not visible

---

## Summary of changes

| Location             | Before                                | After                                              |
| -------------------- | ------------------------------------- | -------------------------------------------------- |
| Event branch, mobile | Pill nav below breadcrumbs            | Removed                                            |
| Venue branch, mobile | Pill nav below breadcrumbs            | Removed                                            |
| Settings, mobile     | Horizontal scroll nav in page content | Removed                                            |
| Mobile drawer        | Global nav links only                 | Global nav + event/venue/settings context sections |
| Desktop sidebar      | Unchanged                             | Unchanged                                          |
