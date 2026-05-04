# Halaman Detail Admin Komite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/admin/settings/committee` menjadi list ringkas 5 kolom (Owner-only), dan tambah halaman detail per-admin di `/admin/settings/committee/[adminProfileId]` dengan tiga tab: Profil & Aksi, Rekening PIC, Acara PIC.

**Architecture:** Tambah `layout.tsx` guard `guardOwner`-equivalent di level `/settings/committee` untuk melindungi semua subroute. Buat query `loadCommitteeAdminDetail`. Refaktor `CommitteeAdminSettingsPanel` ke 5 kolom + `DataTable`. Buat `CommitteeAdminDetailTabs` (Tab 1 profil + dialogs aksi, Tab 2 `AdminPicBankAccountsInline`) dan `CommitteeAdminPicEventsTab` (Tab 3 DataTable acara). Buat server component halaman detail. Semua server actions yang ada dipakai ulang tanpa perubahan.

**Tech Stack:** Next.js 15 App Router (Server Components + Client Components), TanStack Table v8, `@base-ui/react` Tabs, shadcn/ui (base-nova), Prisma, Better Auth

---

### Task 1: Commit Tabs component

**Files:**
- Modify: `src/components/ui/tabs.tsx` (created by `pnpm dlx shadcn@latest add tabs`)

- [ ] **Step 1: Verify `tabs.tsx` exists**

```bash
ls src/components/ui/tabs.tsx
```

Expected: file exists. If missing, run (from project root with `nvm use`):

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm dlx shadcn@latest add tabs
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/tabs.tsx
git commit -m "feat(ui): add Tabs component via shadcn"
```

---

### Task 2: Extend DataTable with global filter, select filter, pagination

**Files:**
- Modify: `src/components/ui/data-table.tsx`

The existing `DataTable` only has sorting. This task adds three optional features:
- **Global text filter** (`enableGlobalFilter`) — searches across all string columns via TanStack `globalFilter`
- **Select filter** (`filterSelectColumn` + `filterSelectOptions`) — column-specific enum filter via `columnFilters`
- **Client-side pagination** (`enablePagination`, `pageSize`) — via `getPaginationRowModel()`

All new props are optional with defaults matching the current behavior, so existing callers are unaffected.

- [ ] **Step 1: Replace `src/components/ui/data-table.tsx` entirely**

```tsx
"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  enableSorting?: boolean;
  getRowClassName?: (row: TData) => string | undefined;
  enableGlobalFilter?: boolean;
  globalFilterPlaceholder?: string;
  filterSelectColumn?: string;
  filterSelectOptions?: { label: string; value: string }[];
  filterSelectAllLabel?: string;
  enablePagination?: boolean;
  pageSize?: number;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results.",
  enableSorting = true,
  getRowClassName,
  enableGlobalFilter = false,
  globalFilterPlaceholder = "Cari...",
  filterSelectColumn,
  filterSelectOptions,
  filterSelectAllLabel = "Semua",
  enablePagination = false,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const needsFiltering = enableGlobalFilter || !!filterSelectColumn;

  /* eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is the supported API */
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(needsFiltering ? { getFilteredRowModel: getFilteredRowModel() } : {}),
    ...(enableSorting
      ? { getSortedRowModel: getSortedRowModel(), onSortingChange: setSorting }
      : { manualSorting: true }),
    ...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(enablePagination ? { initialState: { pagination: { pageSize } } } : {}),
    state: {
      sorting,
      ...(enableGlobalFilter ? { globalFilter } : {}),
      ...(!!filterSelectColumn ? { columnFilters } : {}),
    },
    ...(enableGlobalFilter ? { onGlobalFilterChange: setGlobalFilter } : {}),
    ...(!!filterSelectColumn ? { onColumnFiltersChange: setColumnFilters } : {}),
  });

  const selectFilterValue =
    (columnFilters.find((f) => f.id === filterSelectColumn)?.value as string | undefined) ??
    "__all__";

  function handleSelectFilterChange(value: string) {
    setColumnFilters(
      value === "__all__" ? [] : [{ id: filterSelectColumn!, value }],
    );
  }

  const showFiltersBar =
    enableGlobalFilter || (!!filterSelectColumn && !!filterSelectOptions);

  return (
    <div className="space-y-3">
      {showFiltersBar && (
        <div className="flex flex-wrap items-center gap-2">
          {enableGlobalFilter && (
            <Input
              placeholder={globalFilterPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-xs"
            />
          )}
          {filterSelectColumn && filterSelectOptions && (
            <Select value={selectFilterValue} onValueChange={handleSelectFilterChange}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{filterSelectAllLabel}</SelectItem>
                {filterSelectOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(getRowClassName?.(row.original))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && (
        <div className="flex items-center justify-between border-t px-2 py-3">
          <p className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length === 0 ? (
              "Tidak ada baris."
            ) : (
              <>
                Halaman{" "}
                <span className="font-medium text-foreground">
                  {table.getState().pagination.pageIndex + 1}
                </span>{" "}
                /{" "}
                <span className="font-medium text-foreground">
                  {table.getPageCount()}
                </span>
                {" — "}
                <span className="font-medium text-foreground">
                  {table.getFilteredRowModel().rows.length}
                </span>{" "}
                baris
              </>
            )}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify existing DataTable callers still compile**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: zero errors (or same errors as baseline before this task).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/data-table.tsx
git commit -m "feat(ui): extend DataTable — global filter, select filter, client-side pagination"
```

---

### Task 3: Add layout guard for `/admin/settings/committee`

**Files:**
- Create: `src/app/admin/settings/committee/layout.tsx`

Currently there is no layout guard at the committee directory level — the existing guard in `src/app/admin/settings/committee/page.tsx` only applies to that one page. This task adds an `Owner`-only guard that protects the entire `/settings/committee/**` subtree (current list page + the new detail pages), matching the pattern used by `/settings/pricing/layout.tsx`.

- [ ] **Step 1: Create `src/app/admin/settings/committee/layout.tsx`**

```tsx
import { notFound } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export default async function CommitteeGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    notFound();
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/committee/layout.tsx
git commit -m "feat(admin): Owner-only layout guard untuk seluruh subroute committee settings"
```

---

### Task 4: Create `loadCommitteeAdminDetail` query

**Files:**
- Create: `src/lib/admin/load-committee-admin-detail.ts`

Returns all data needed by the detail page in two parallel query rounds:
1. Round 1 (parallel): admin profile + PIC bank accounts, management member options, events as PIC
2. Round 2 (parallel, after profile found): Better Auth user row, last active session

- [ ] **Step 1: Create `src/lib/admin/load-committee-admin-detail.ts`**

```ts
import type { EventStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { CommitteeAdminDirectoryPicBankVm } from "@/lib/admin/load-committee-admin-directory";

export type EventAsPicVm = {
  eventId: string;
  name: string;
  startAtIso: string;
  status: EventStatus;
};

export type CommitteeAdminDetailVm = {
  adminProfileId: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: string;
  managementMemberId: string | null;
  memberSummary: string | null;
  twoFactorEnabled: boolean;
  lastSessionActivityAtIso: string | null;
  picBankAccounts: CommitteeAdminDirectoryPicBankVm[];
  eventsAsPic: EventAsPicVm[];
  memberOptions: { id: string; label: string }[];
};

export async function loadCommitteeAdminDetail(
  adminProfileId: string,
): Promise<CommitteeAdminDetailVm | null> {
  const now = new Date();

  const [profile, memberOptionsRaw, eventsRaw] = await Promise.all([
    prisma.adminProfile.findUnique({
      where: { id: adminProfileId },
      select: {
        id: true,
        authUserId: true,
        role: true,
        managementMemberId: true,
        managementMember: {
          select: { publicCode: true, fullName: true },
        },
        picBankAccounts: {
          orderBy: { bankName: "asc" },
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            accountName: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.managementMember.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, publicCode: true, fullName: true },
    }),
    prisma.event.findMany({
      where: { picAdminProfileId: adminProfileId },
      orderBy: { startAt: "desc" },
      select: { id: true, title: true, startAt: true, status: true },
    }),
  ]);

  if (!profile) return null;

  const [user, lastSession] = await Promise.all([
    prisma.user.findUnique({
      where: { id: profile.authUserId },
      select: { email: true, name: true, twoFactorEnabled: true },
    }),
    prisma.session.findFirst({
      where: { userId: profile.authUserId, expiresAt: { gt: now } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return {
    adminProfileId: profile.id,
    authUserId: profile.authUserId,
    email: user?.email ?? profile.authUserId,
    displayName: user?.name ?? "—",
    role: profile.role,
    managementMemberId: profile.managementMemberId,
    memberSummary: profile.managementMember
      ? `${profile.managementMember.publicCode} — ${profile.managementMember.fullName}`
      : null,
    twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    lastSessionActivityAtIso: lastSession ? lastSession.updatedAt.toISOString() : null,
    picBankAccounts: profile.picBankAccounts,
    eventsAsPic: eventsRaw.map((e) => ({
      eventId: e.id,
      name: e.title,
      startAtIso: e.startAt.toISOString(),
      status: e.status,
    })),
    memberOptions: memberOptionsRaw.map((m) => ({
      id: m.id,
      label: `${m.publicCode} — ${m.fullName}`,
    })),
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/load-committee-admin-detail.ts
git commit -m "feat(admin): loadCommitteeAdminDetail — profil + rekening PIC + acara sebagai PIC"
```

---

### Task 5: Refactor CommitteeAdminSettingsPanel + update list page

**Files:**
- Modify: `src/components/admin/committee-admin-settings-panel.tsx`
- Modify: `src/app/admin/settings/committee/page.tsx`

**What changes in the panel:**
- Removed: `ManageAdminDialogs` and all its sub-components (`CommitteeRoleSelectField`, `CommitteeManagementMemberCombobox`)
- Removed: expand/collapse row state and `AdminPicBankAccountsInline` inline expansion
- Removed props: `viewerProfileId`, `viewerRole` (page is now Owner-only via layout guard)
- Removed: `canInvite` check — always shown since page is Owner-only
- Changed: admin list uses `DataTable` with 5 columns (email, nama, peran, sesi, aksi→Detail link)
- Changed: invitations table uses `DataTable` with select filter by status
- Kept: `InviteAdminForm`, `RevokeInvitationForm`, invite dialog

**What changes in `page.tsx`:** removes `requireAdminSession`/`getAdminContext` calls (now redundant — layout guard already validates), removes props no longer accepted by the panel.

- [ ] **Step 1: Replace `src/components/admin/committee-admin-settings-panel.tsx`**

```tsx
"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminRole } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

import type {
  CommitteeAdminDirectoryRowVm,
  CommitteeAdminDirectoryVm,
} from "@/lib/admin/load-committee-admin-directory";
import type { PendingAdminInvitationRowVm } from "@/lib/admin/load-pending-admin-invitations";
import {
  createAdminInvitation,
  revokeAdminInvitation,
  type CreateAdminInvitationResult,
} from "@/lib/actions/admin-admin-invitations";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const ROLE_LABELS: Record<string, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

const ROLE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  Owner: "default",
  Admin: "secondary",
  Verifier: "outline",
  Viewer: "outline",
};

function formatSessionHint(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatInviteExpiry(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fieldErrorsLines(fieldErrors?: Record<string, string>) {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return null;
  return Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function InviteInviteeRoleSelect({ disabled }: { disabled: boolean }) {
  const [role, setRole] = useState<AdminRole>(AdminRole.Viewer);
  return (
    <>
      <input type="hidden" name="role" value={role} />
      <Select
        value={role}
        onValueChange={(v) => {
          if (v != null) setRole(v as AdminRole);
        }}
        disabled={disabled}
      >
        <SelectTrigger id="invite-admin-role" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AdminRole.Admin}>Admin</SelectItem>
          <SelectItem value={AdminRole.Verifier}>Verifier</SelectItem>
          <SelectItem value={AdminRole.Viewer}>Viewer</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

function InviteAdminForm({ onCloseDialog }: { onCloseDialog: () => void }) {
  const emailedSentRef = useRef(false);
  const [inviteState, inviteDispatch, invitePending] = useActionState(
    createAdminInvitation,
    null as ActionResult<CreateAdminInvitationResult> | null,
  );

  useEffect(() => {
    if (!inviteState?.ok) return;
    if (inviteState.data.inviteUrl) return;
    if (emailedSentRef.current) return;
    emailedSentRef.current = true;
    toastCudSuccess("create", "Undangan dibuat — email undangan telah dikirim.");
    onCloseDialog();
  }, [inviteState, onCloseDialog]);

  const inviteFieldLines = fieldErrorsLines(
    inviteState?.ok === false ? inviteState.fieldErrors : undefined,
  );

  if (inviteState?.ok === true && inviteState.data.inviteUrl) {
    const url = inviteState.data.inviteUrl;
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Salin taut undangan</AlertTitle>
          <AlertDescription>
            Email pengiriman tidak digunakan atau gagal — berikan taut ini secara langsung kepada
            penerima (rahasia, satu orang).
          </AlertDescription>
        </Alert>
        <Input readOnly value={url} className="font-mono text-xs" />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(
                () => toast.success("Taut disalin."),
                () => toast.error("Salin gagal — pilih manual."),
              );
            }}
          >
            Salin taut
          </Button>
          <Button type="button" variant="outline" onClick={() => onCloseDialog()}>
            Tutup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={inviteDispatch} className="space-y-4">
      {inviteState?.ok === false && inviteState.rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{inviteState.rootError}</AlertDescription>
        </Alert>
      ) : null}
      {inviteFieldLines ? (
        <Alert variant="destructive">
          <AlertTitle>Periksa isian</AlertTitle>
          <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
            {inviteFieldLines}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="invite-admin-email">Email</Label>
        <Input
          id="invite-admin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={invitePending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-admin-role">Peran pertama</Label>
        <InviteInviteeRoleSelect disabled={invitePending} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={invitePending}>
          {invitePending ? <Loader2 className="size-4 animate-spin" /> : "Kirim undangan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RevokeInvitationForm(props: { invitationId: string }) {
  const router = useRouter();
  const revokedRef = useRef(false);
  const [revokeInvState, revokeInvDispatch, revokeInvPending] = useActionState(
    revokeAdminInvitation,
    null as ActionResult<{ revoked: true }> | null,
  );

  useEffect(() => {
    if (!revokeInvState?.ok || revokedRef.current) return;
    revokedRef.current = true;
    toast.success("Undangan dibatalkan.");
    router.refresh();
  }, [revokeInvState, router]);

  return (
    <form action={revokeInvDispatch} className="inline">
      <input type="hidden" name="invitationId" value={props.invitationId} />
      <Button type="submit" variant="outline" size="sm" disabled={revokeInvPending}>
        Batalkan
      </Button>
    </form>
  );
}

export function CommitteeAdminSettingsPanel(props: {
  directory: CommitteeAdminDirectoryVm;
  pendingInvitations: PendingAdminInvitationRowVm[];
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteFormKey, setInviteFormKey] = useState(0);

  const closeInviteDialog = useCallback(() => setInviteOpen(false), []);

  const adminColumns = useMemo<ColumnDef<CommitteeAdminDirectoryRowVm>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="font-mono text-xs sm:text-sm">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "displayName",
        header: "Nama",
      },
      {
        accessorKey: "role",
        header: "Peran",
        filterFn: "equals",
        cell: ({ row }) => (
          <Badge variant={ROLE_BADGE_VARIANT[row.original.role] ?? "outline"}>
            {ROLE_LABELS[row.original.role] ?? row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: "lastSessionActivityAtIso",
        header: "Aktivitas sesi*",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {formatSessionHint(row.original.lastSessionActivityAtIso)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/settings/committee/${row.original.adminProfileId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Detail →
          </Link>
        ),
      },
    ],
    [],
  );

  const invitationColumns = useMemo<ColumnDef<PendingAdminInvitationRowVm>[]>(
    () => [
      {
        accessorKey: "emailNormalized",
        header: "Email",
        cell: ({ row }) => (
          <span className="font-mono text-xs sm:text-sm">{row.original.emailNormalized}</span>
        ),
      },
      {
        accessorKey: "role",
        header: "Peran",
        cell: ({ row }) => ROLE_LABELS[row.original.role] ?? row.original.role,
      },
      {
        id: "status",
        header: "Status / kedaluwarsa",
        enableSorting: false,
        filterFn: (_row, _columnId, filterValue: string) => {
          if (filterValue === "expired") return _row.original.isExpired;
          if (filterValue === "active") return !_row.original.isExpired;
          return true;
        },
        cell: ({ row }) =>
          row.original.isExpired ? (
            <span className="text-destructive text-sm">Kedaluwarsa</span>
          ) : (
            <span className="text-muted-foreground text-sm">
              Aktif sampai {formatInviteExpiry(row.original.expiresAtIso)}
            </span>
          ),
      },
      {
        id: "inv-actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            <RevokeInvitationForm key={row.original.id} invitationId={row.original.id} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Admin terdaftar</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/settings/committee/export"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Unduh CSV
          </Link>
          <Dialog
            open={inviteOpen}
            onOpenChange={(o) => {
              setInviteOpen(o);
              if (o) setInviteFormKey((k) => k + 1);
            }}
          >
            <DialogTrigger render={<Button variant="default" />}>
              Undang admin baru…
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Undang admin baru</DialogTitle>
                <DialogDescription>
                  Untuk email yang belum punya akun pengguna. Penerima mendapat taut untuk menetapkan
                  nama dan kata sandi lewat halaman onboarding.
                </DialogDescription>
              </DialogHeader>
              <InviteAdminForm key={inviteFormKey} onCloseDialog={closeInviteDialog} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Undangan tertunda</h3>
        {props.pendingInvitations.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada undangan yang menunggu.</p>
        ) : (
          <DataTable
            columns={invitationColumns}
            data={props.pendingInvitations}
            emptyMessage="Tidak ada undangan tertunda."
            enableSorting={false}
            filterSelectColumn="status"
            filterSelectOptions={[
              { label: "Aktif", value: "active" },
              { label: "Kedaluwarsa", value: "expired" },
            ]}
            filterSelectAllLabel="Semua status"
            enablePagination
            pageSize={10}
          />
        )}
      </div>

      <DataTable
        columns={adminColumns}
        data={props.directory.rows}
        emptyMessage="Belum ada AdminProfile."
        enableGlobalFilter
        globalFilterPlaceholder="Cari nama atau email..."
        filterSelectColumn="role"
        filterSelectOptions={[
          { label: "Owner", value: "Owner" },
          { label: "Admin", value: "Admin" },
          { label: "Verifier", value: "Verifier" },
          { label: "Viewer", value: "Viewer" },
        ]}
        filterSelectAllLabel="Semua peran"
        enablePagination
        pageSize={10}
      />

      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="font-medium text-foreground">*</span> Berdasarkan sesi aktif yang belum
        kedaluwarsa (pembaruan terbaru dari tabel sesi Better Auth). Untuk rekonsiliasi lebih
        lengkap pakai Pengaturan →{" "}
        <Link href="/admin/settings/security" className="underline underline-offset-4">
          Keamanan
        </Link>{" "}
        (log audit). Darurat penyediaan akun baru masih bisa lewat CLI{" "}
        <code className="font-mono text-[11px]">pnpm bootstrap:admin</code>.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/admin/settings/committee/page.tsx`**

The layout guard (Task 3) already validates session + Owner role. The page no longer needs `viewerCtx` since the panel no longer accepts those props.

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import { CommitteeAdminSettingsPanel } from "@/components/admin/committee-admin-settings-panel";
import { loadCommitteeAdminDirectory } from "@/lib/admin/load-committee-admin-directory";
import { loadPendingAdminInvitationsForCommittee } from "@/lib/admin/load-pending-admin-invitations";

export const metadata: Metadata = { title: "Komite" };

export default async function CommitteeSettingsPage() {
  const [directory, pendingInvitations] = await Promise.all([
    loadCommitteeAdminDirectory(),
    loadPendingAdminInvitationsForCommittee(),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">
            <Link href="/admin/settings" className="underline underline-offset-4">
              Pengaturan
            </Link>
            {" / "}
            <span>Komite & admin</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Komite & admin aplikasi</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          <strong className="text-foreground">Master anggota</strong> dikelola di halaman{" "}
          <Link href="/admin/members" className="font-medium text-foreground underline">
            Anggota
          </Link>
          . <strong className="text-foreground">PIC utama acara</strong> adalah{" "}
          <strong className="text-foreground">profil admin</strong> (bukan flag di direktori);{" "}
          <strong className="text-foreground">rekening pembayaran</strong> dipasangkan ke profil
          admin di bawah. Di halaman ini yang diatur adalah{" "}
          <strong className="text-foreground">identitas akses aplikasi</strong>: peran
          Owner/Admin/Verifier/Viewer dan tautan opsional ke baris direktori anggota.
        </p>
        <div className="border-border rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
          <p className="font-medium text-foreground">Langkah biasa</p>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 ps-5">
            <li>
              Untuk admin baru, gunakan{" "}
              <strong className="text-foreground">Undang admin baru</strong> — orang tersebut
              menerima taut onboarding (email bisa dikirim otomatis bila SMTP aktif).
            </li>
            <li>
              Pastikan direktori anggota dan (bila perlu) rekening PIC di profil admin sudah siap
              sebelum PIC acara.
            </li>
            <li>
              Gunakan{" "}
              <Link href="/admin/settings/security" className="underline underline-offset-4">
                Keamanan
              </Link>{" "}
              untuk log audit konfigurasi.
            </li>
          </ol>
        </div>
      </div>

      <CommitteeAdminSettingsPanel
        directory={directory}
        pendingInvitations={pendingInvitations}
      />
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/committee-admin-settings-panel.tsx \
        src/app/admin/settings/committee/page.tsx
git commit -m "refactor(admin): pangkas committee list ke 5 kolom + DataTable, hapus inline expand & per-row dialogs"
```

---

### Task 6: Create `CommitteeAdminDetailTabs`

**Files:**
- Create: `src/components/admin/committee-admin-detail-tabs.tsx`

This is the main client component for the detail page. It manages tab state and renders:
- **Tab 1**: Profile info grid + action buttons that open dialogs (role, member link, revoke, delete)
- **Tab 2**: `AdminPicBankAccountsInline` (unchanged component, just moved here)
- **Tab 3**: `CommitteeAdminPicEventsTab` (created in Task 7)

After a successful **delete**, navigates to `/admin/settings/committee` (the admin no longer exists). After other successful mutations, calls `router.refresh()` to reload server data.

- [ ] **Step 1: Create `src/components/admin/committee-admin-detail-tabs.tsx`**

```tsx
"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@prisma/client";

import type { CommitteeAdminDetailVm } from "@/lib/admin/load-committee-admin-detail";
import {
  deleteCommitteeAdmin,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminMemberLink,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";
import { AdminPicBankAccountsInline } from "@/components/admin/admin-pic-bank-accounts-inline";
import { CommitteeAdminPicEventsTab } from "@/components/admin/committee-admin-pic-events-tab";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

type ActiveDialog = "role" | "member" | "revoke" | "delete" | null;

function fieldErrorsLines(fieldErrors?: Record<string, string>) {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return null;
  return Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function RoleSelectField(props: {
  htmlId: string;
  initialRole: string;
  disabled: boolean;
}) {
  const [role, setRole] = useState(props.initialRole);
  return (
    <>
      <input type="hidden" name="role" value={role} />
      <Select
        value={role}
        onValueChange={(v) => {
          if (v != null) setRole(v);
        }}
        disabled={props.disabled}
      >
        <SelectTrigger id={props.htmlId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Owner">Owner</SelectItem>
          <SelectItem value="Admin">Admin</SelectItem>
          <SelectItem value="Verifier">Verifier</SelectItem>
          <SelectItem value="Viewer">Viewer</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

function MemberComboboxField(props: {
  htmlId: string;
  initialManagementMemberId: string | null;
  memberOptions: { id: string; label: string }[];
  disabled: boolean;
}) {
  const comboOptions = useMemo(
    () => props.memberOptions.map((o) => ({ value: o.id, label: o.label })),
    [props.memberOptions],
  );
  const [value, setValue] = useState<string | null>(props.initialManagementMemberId);
  return (
    <>
      <input type="hidden" name="managementMemberId" value={value ?? ""} />
      <EntityCombobox
        id={props.htmlId}
        placeholder="— Tidak dikaitkan"
        value={value}
        onValueChange={setValue}
        options={comboOptions}
        disabled={props.disabled}
      />
    </>
  );
}

const SESSION_FMT = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "short",
  timeStyle: "short",
});

export function CommitteeAdminDetailTabs(props: {
  detail: CommitteeAdminDetailVm;
  viewerProfileId: string;
  viewerRole: AdminRole;
}) {
  const { detail } = props;
  const router = useRouter();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [roleState, roleDispatch, rolePending] = useActionState(
    updateCommitteeAdminRole,
    null as ActionResult<{ saved: true }> | null,
  );
  const [memberState, memberDispatch, memberPending] = useActionState(
    updateCommitteeAdminMemberLink,
    null as ActionResult<{ saved: true }> | null,
  );
  const [revokeState, revokeDispatch, revokePending] = useActionState(
    revokeCommitteeAdminMeaningfulAccess,
    null as ActionResult<{ saved: true }> | null,
  );
  const [deleteState, deleteDispatch, deletePending] = useActionState(
    deleteCommitteeAdmin,
    null as ActionResult<{ deleted: true }> | null,
  );

  useEffect(() => {
    if (deleteState?.ok) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setActiveDialog(null);
      setDialogKey((k) => k + 1);
      router.push("/admin/settings/committee");
      return;
    }
    if (roleState?.ok || memberState?.ok || revokeState?.ok) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setActiveDialog(null);
      setDialogKey((k) => k + 1);
      router.refresh();
    }
  }, [roleState?.ok, memberState?.ok, revokeState?.ok, deleteState?.ok, router]);

  useEffect(() => {
    if (roleState?.ok) toastCudSuccess("update", "Peran admin diperbarui.");
  }, [roleState]);
  useEffect(() => {
    if (memberState?.ok) toastCudSuccess("update", "Tautan anggota diperbarui.");
  }, [memberState]);
  useEffect(() => {
    if (revokeState?.ok) toastCudSuccess("update", "Akses admin dicabut.");
  }, [revokeState]);
  useEffect(() => {
    if (deleteState?.ok) toastCudSuccess("delete", "Admin komite dihapus.");
  }, [deleteState]);

  const onBankSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const actionDisabled = rolePending || memberPending || revokePending || deletePending;

  return (
    <Tabs defaultValue="profil" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profil">Profil & Aksi</TabsTrigger>
        <TabsTrigger value="rekening">
          Rekening PIC ({detail.picBankAccounts.length})
        </TabsTrigger>
        <TabsTrigger value="acara">
          Acara PIC ({detail.eventsAsPic.length})
        </TabsTrigger>
      </TabsList>

      {/* ── Tab 1: Profil & Aksi ── */}
      <TabsContent value="profil" className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Peran</p>
            <p>{detail.role}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Anggota terkait</p>
            <p>{detail.memberSummary ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">2FA</p>
            <p>{detail.twoFactorEnabled ? "Aktif" : "Tidak aktif"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Aktivitas sesi*</p>
            <p className="text-xs">
              {detail.lastSessionActivityAtIso
                ? SESSION_FMT.format(new Date(detail.lastSessionActivityAtIso))
                : "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("role")}
          >
            Ubah peran
          </Button>
          <Button
            variant="outline"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("member")}
          >
            Tautan anggota
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("revoke")}
          >
            Cabut akses
          </Button>
          <Button
            variant="destructive"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("delete")}
          >
            Hapus profil & akun
          </Button>
        </div>

        {/* Dialog: Ubah peran */}
        <Dialog
          open={activeDialog === "role"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ubah peran admin</DialogTitle>
              <DialogDescription>
                {detail.email} — peran baru berlaku segera setelah disimpan.
              </DialogDescription>
            </DialogHeader>
            <form action={roleDispatch} className="space-y-4" key={`r-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
              {roleState?.ok === false && roleState.rootError ? (
                <Alert variant="destructive">
                  <AlertTitle>Gagal</AlertTitle>
                  <AlertDescription>{roleState.rootError}</AlertDescription>
                </Alert>
              ) : null}
              {fieldErrorsLines(
                roleState?.ok === false ? roleState.fieldErrors : undefined,
              ) ? (
                <Alert variant="destructive">
                  <AlertTitle>Periksa isian</AlertTitle>
                  <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                    {fieldErrorsLines(
                      roleState?.ok === false ? roleState.fieldErrors : undefined,
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="detail-role-select">Peran</Label>
                <RoleSelectField
                  htmlId="detail-role-select"
                  initialRole={detail.role}
                  disabled={rolePending}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={rolePending}>
                  {rolePending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Simpan peran"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Tautan anggota */}
        <Dialog
          open={activeDialog === "member"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hubungkan ke MasterMember</DialogTitle>
              <DialogDescription>
                Opsional. PIC acara dan rekening dikonfigurasi lewat profil admin (bukan lewat flag
                di Anggota).
              </DialogDescription>
            </DialogHeader>
            <form action={memberDispatch} className="space-y-4" key={`m-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
              {memberState?.ok === false && memberState.rootError ? (
                <Alert variant="destructive">
                  <AlertTitle>Gagal</AlertTitle>
                  <AlertDescription>{memberState.rootError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="detail-member-combo">Pengurus</Label>
                <MemberComboboxField
                  htmlId="detail-member-combo"
                  initialManagementMemberId={detail.managementMemberId}
                  memberOptions={detail.memberOptions}
                  disabled={memberPending}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={memberPending}>
                  {memberPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Simpan tautan"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Cabut akses */}
        <Dialog
          open={activeDialog === "revoke"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cabut akses bermakna</DialogTitle>
              <DialogDescription>
                Mengatur peran menjadi Viewer dan menghapus tautan anggota untuk{" "}
                <strong>{detail.email}</strong>. Profil tidak dihapus.
              </DialogDescription>
            </DialogHeader>
            {revokeState?.ok === false && revokeState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{revokeState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={revokeDispatch} key={`v-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={revokePending}>
                  {revokePending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Ya, cabut akses"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Hapus profil */}
        <Dialog
          open={activeDialog === "delete"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus profil admin</DialogTitle>
              <DialogDescription>
                Menghapus profil dan akun masuk untuk <strong>{detail.email}</strong> secara
                permanen. Tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {deleteState?.ok === false && deleteState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{deleteState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={deleteDispatch} key={`d-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={deletePending}>
                  {deletePending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Ya, hapus profil & akun"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <p className="text-muted-foreground text-xs">
          * Berdasarkan sesi aktif yang belum kedaluwarsa.
        </p>
      </TabsContent>

      {/* ── Tab 2: Rekening PIC ── */}
      <TabsContent value="rekening">
        <AdminPicBankAccountsInline
          key={`banks-${dialogKey}`}
          ownerAdminProfileId={detail.adminProfileId}
          viewerProfileId={props.viewerProfileId}
          viewerRole={props.viewerRole}
          accounts={detail.picBankAccounts}
          onMutationSuccess={onBankSuccess}
        />
      </TabsContent>

      {/* ── Tab 3: Acara PIC ── */}
      <TabsContent value="acara">
        <CommitteeAdminPicEventsTab events={detail.eventsAsPic} />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 2: Note — TypeScript will report a missing module error for `CommitteeAdminPicEventsTab` until Task 7 is complete. Proceed to Task 7 before running tsc.**

---

### Task 7: Create `CommitteeAdminPicEventsTab`

**Files:**
- Create: `src/components/admin/committee-admin-pic-events-tab.tsx`

- [ ] **Step 1: Create `src/components/admin/committee-admin-pic-events-tab.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { EventStatus } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import type { VariantProps } from "class-variance-authority";

import type { EventAsPicVm } from "@/lib/admin/load-committee-admin-detail";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const EVENT_STATUS: Record<EventStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Aktif", variant: "default" },
  draft: { label: "Draf", variant: "secondary" },
  finished: { label: "Selesai", variant: "outline" },
};

const fmtDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

export function CommitteeAdminPicEventsTab(props: { events: EventAsPicVm[] }) {
  const { events } = props;

  const activeCount = events.filter((e) => e.status === "active").length;
  const finishedCount = events.filter((e) => e.status === "finished").length;

  const columns = useMemo<ColumnDef<EventAsPicVm>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama Acara",
      },
      {
        accessorKey: "startAtIso",
        header: "Tanggal",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {fmtDate.format(new Date(row.original.startAtIso))}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        filterFn: "equals",
        cell: ({ row }) => {
          const cfg = EVENT_STATUS[row.original.status];
          return (
            <Badge variant={cfg?.variant ?? "outline"}>
              {cfg?.label ?? row.original.status}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/events/${row.original.eventId}/inbox`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            → Inbox
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      {events.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {activeCount > 0 && <span>{activeCount} aktif</span>}
          {activeCount > 0 && finishedCount > 0 && <span> · </span>}
          {finishedCount > 0 && <span>{finishedCount} selesai</span>}
        </p>
      )}
      <DataTable
        columns={columns}
        data={events}
        emptyMessage="Belum ada acara sebagai PIC."
        enableGlobalFilter
        globalFilterPlaceholder="Cari nama acara..."
        filterSelectColumn="status"
        filterSelectOptions={[
          { label: "Aktif", value: "active" },
          { label: "Selesai", value: "finished" },
          { label: "Draf", value: "draft" },
        ]}
        filterSelectAllLabel="Semua status"
        enablePagination
        pageSize={10}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check (covers both Task 6 and Task 7)**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 3: Commit Tasks 6 and 7 together**

```bash
git add src/components/admin/committee-admin-detail-tabs.tsx \
        src/components/admin/committee-admin-pic-events-tab.tsx
git commit -m "feat(admin): CommitteeAdminDetailTabs (Profil+Aksi, Rekening PIC) + CommitteeAdminPicEventsTab (Acara PIC)"
```

---

### Task 8: Create detail page server component

**Files:**
- Create: `src/app/admin/settings/committee/[adminProfileId]/page.tsx`

The layout guard (Task 3) already validates Owner. This page calls `loadCommitteeAdminDetail`, renders a breadcrumb header, and delegates to `CommitteeAdminDetailTabs`.

- [ ] **Step 1: Create `src/app/admin/settings/committee/[adminProfileId]/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminRole } from "@prisma/client";

import { CommitteeAdminDetailTabs } from "@/components/admin/committee-admin-detail-tabs";
import { loadCommitteeAdminDetail } from "@/lib/admin/load-committee-admin-detail";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Detail Admin" };

export default async function CommitteeAdminDetailPage({
  params,
}: {
  params: Promise<{ adminProfileId: string }>;
}) {
  const { adminProfileId } = await params;

  const session = await requireAdminSession();
  const viewerCtx = await getAdminContext(session.user.id);
  if (!viewerCtx) notFound();

  const detail = await loadCommitteeAdminDetail(adminProfileId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <Link
            href="/admin/settings/committee"
            className="underline underline-offset-4"
          >
            Komite & admin
          </Link>
          {" / "}
          <span>{detail.displayName}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.displayName}
            </h1>
            <p className="text-muted-foreground text-sm">{detail.email}</p>
          </div>
          <Badge>{detail.role}</Badge>
        </div>
      </div>

      <CommitteeAdminDetailTabs
        detail={detail}
        viewerProfileId={viewerCtx.profileId}
        viewerRole={viewerCtx.role as AdminRole}
      />
    </div>
  );
}
```

- [ ] **Step 2: Full TypeScript check**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 3: Full build**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build 2>&1 | tail -30
```

Expected: build succeeds, no type or compile errors.

- [ ] **Step 4: Lint**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint 2>&1 | grep -v "^$" | head -30
```

Expected: no new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/settings/committee/[adminProfileId]/page.tsx
git commit -m "feat(admin): halaman detail admin komite — tab Profil & Aksi, Rekening PIC, Acara PIC"
```
