# Kepengurusan Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full admin UI for the kepengurusan module — hub page, period roster, global member list, and global role list — wiring all existing server actions to React forms and tables.

**Architecture:** Each page follows the RSC → client component pattern used throughout the admin. RSC fetches data and passes typed props; client component manages all dialog open/close state and calls `router.refresh()` after mutations. Four dialog components handle CRUD for the four entities. All server actions, Zod schemas, and database models already exist.

**Tech Stack:** Next.js App Router (RSC + `"use client"`), react-hook-form + zodResolver, `@/components/ui/dialog` (base-ui/react backed), shadcn Select, shadcn DropdownMenu, `useRouter().refresh()` for revalidation, Prisma (read-only in RSC), Lucide icons.

---

## Spec → Task map

| Spec § | Task |
|--------|------|
| §4 Hub page | Tasks 1–2 |
| §6 Members page | Tasks 3–4 |
| §7 Roles page | Tasks 5–6 |
| §5 Period roster | Tasks 7–8 |

---

## Key patterns (read before coding)

**Dialog pattern** — dialogs are controlled from the parent via `open` / `onOpenChange` props. Never use `DialogTrigger` inside the dialog component itself; the parent component holds the open state with `useState` and renders `<TheDialog open={...} onOpenChange={...} />`.

**Form submit pattern** (copy from `MemberFormDialog`):
```ts
startTransition(async () => {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(values));
  const result = await serverAction(undefined, fd);
  if (!result.ok) {
    for (const [f, m] of Object.entries(result.fieldErrors ?? {}))
      form.setError(f as keyof FormValues, { message: m });
    setRootMessage(result.rootError ?? "Terjadi kesalahan.");
    return;
  }
  onOpenChange(false);
  onSaved();
});
```

**Root error display** (always use this exact JSX):
```tsx
{rootMessage ? (
  <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
    {rootMessage}
  </p>
) : null}
```

**DropdownMenu trigger** (render prop, not asChild):
```tsx
<DropdownMenuTrigger
  aria-label="Aksi"
  render={<Button type="button" variant="ghost" size="icon-sm" />}
>
  <MoreVerticalIcon />
</DropdownMenuTrigger>
```

**Field helper** (copy from `MemberFormDialog` — reuse in every dialog):
```tsx
function Field({ label, htmlFor, error, children }: {
  label: string; htmlFor: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
```

**After successful mutation** — always call `router.refresh()` (not `revalidatePath` — that's for the server; the client needs `router.refresh()` to re-fetch RSC data).

---

## Task 1: Period form dialog

**Files:**
- Create: `src/components/admin/management-period-form-dialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBoardPeriod,
  deleteBoardPeriod,
  updateBoardPeriod,
} from "@/lib/actions/admin-board-periods";
import {
  adminBoardPeriodCreateSchema,
  adminBoardPeriodUpdateSchema,
} from "@/lib/forms/admin-board-period-schema";

type PeriodRow = {
  id: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
};

type FormValues = {
  id?: string;
  label: string;
  startsAt: string;
  endsAt: string;
};

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: PeriodRow | null;
  onSaved: () => void;
};

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ManagementPeriodFormDialog({
  mode,
  open,
  onOpenChange,
  period,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(
    () => ({
      id: period?.id,
      label: period?.label ?? "",
      startsAt: period ? toDateInputValue(period.startsAt) : "",
      endsAt: period ? toDateInputValue(period.endsAt) : "",
    }),
    [period],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(
      (mode === "create"
        ? adminBoardPeriodCreateSchema
        : adminBoardPeriodUpdateSchema) as never,
    ) as Resolver<FormValues>,
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setRootMessage(null);
      setDeleteError(null);
      setShowDeleteConfirm(false);
    }
  }, [open, defaultValues, form]);

  function submit(values: FormValues) {
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      const payload =
        mode === "create"
          ? { label: values.label, startsAt: values.startsAt, endsAt: values.endsAt }
          : { id: period?.id ?? "", label: values.label, startsAt: values.startsAt, endsAt: values.endsAt };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createBoardPeriod(undefined, fd)
          : await updateBoardPeriod(undefined, fd);
      if (!result.ok) {
        for (const [f, m] of Object.entries(result.fieldErrors ?? {}))
          form.setError(f as keyof FormValues, { message: m });
        setRootMessage(result.rootError ?? "Terjadi kesalahan.");
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  function handleDelete() {
    if (!period) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: period.id }));
      const result = await deleteBoardPeriod(undefined, fd);
      if (!result.ok) {
        setDeleteError(result.rootError ?? "Gagal menghapus periode.");
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) { setRootMessage(null); setDeleteError(null); setShowDeleteConfirm(false); }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah periode" : "Edit periode"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Buat periode kabinet baru."
              : "Perbarui data periode kabinet."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          <Field label="Label periode" htmlFor="period-label" error={form.formState.errors.label?.message}>
            <Input id="period-label" disabled={isPending} {...form.register("label")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal mulai" htmlFor="period-starts-at" error={form.formState.errors.startsAt?.message}>
              <Input id="period-starts-at" type="date" disabled={isPending} {...form.register("startsAt")} />
            </Field>
            <Field label="Tanggal akhir" htmlFor="period-ends-at" error={form.formState.errors.endsAt?.message}>
              <Input id="period-ends-at" type="date" disabled={isPending} {...form.register("endsAt")} />
            </Field>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === "edit" && !showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Hapus
              </Button>
            ) : null}
            {mode === "edit" && showDeleteConfirm ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-sm text-destructive">Yakin hapus?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Ya, hapus"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                >
                  Batal
                </Button>
              </div>
            ) : null}
            {deleteError ? (
              <p className="text-sm text-destructive">{deleteError}</p>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, error, children }: {
  label: string; htmlFor: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors in this new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/management-period-form-dialog.tsx
git commit -m "feat(admin): management period form dialog (create/edit/delete)"
```

---

## Task 2: Hub page

**Files:**
- Create: `src/components/admin/management-hub-page.tsx`
- Modify: `src/app/admin/management/page.tsx`

- [ ] **Step 1: Create client component**

```tsx
// src/components/admin/management-hub-page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVerticalIcon, PlusIcon, UsersRoundIcon, TagIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagementPeriodFormDialog } from "@/components/admin/management-period-form-dialog";

type PeriodRow = {
  id: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  assignmentCount: number;
};

type Props = {
  periods: PeriodRow[];
  activePeriodId: string | null;
};

export function ManagementHubPage({ periods, activePeriodId }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PeriodRow | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kepengurusan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola periode kabinet, daftar pengurus, dan jabatan organisasi.
        </p>
      </div>

      {/* Card links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/admin/management/members"
          className="flex items-start gap-3 rounded-lg border p-4 hover:bg-muted/50"
        >
          <UsersRoundIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Daftar Pengurus</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kelola ManagementMember — nama, kode publik, tautan anggota.
            </p>
          </div>
        </Link>
        <Link
          href="/admin/management/roles"
          className="flex items-start gap-3 rounded-lg border p-4 hover:bg-muted/50"
        >
          <TagIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Jabatan</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kelola BoardRole — nama jabatan dan urutan tampil.
            </p>
          </div>
        </Link>
      </div>

      {/* Periods */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Periode Kabinet</h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Tambah Periode
          </Button>
        </div>

        {periods.length === 0 ? (
          <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Belum ada periode. Klik "Tambah Periode" untuk membuat yang pertama.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {periods.map((p) => {
              const isActive = p.id === activePeriodId;
              return (
                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    {isActive ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Aktif
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {p.startsAt.toISOString().slice(0, 10)} →{" "}
                      {p.endsAt.toISOString().slice(0, 10)} · {p.assignmentCount} penugasan
                    </span>
                    <Link
                      href={`/admin/management/${p.id}`}
                      className="text-primary hover:underline"
                    >
                      Lihat roster →
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${p.label}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingPeriod(p)}>
                          Edit periode
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setEditingPeriod(p)}
                        >
                          Hapus periode
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ManagementPeriodFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />
      {editingPeriod ? (
        <ManagementPeriodFormDialog
          mode="edit"
          open={Boolean(editingPeriod)}
          onOpenChange={(open) => { if (!open) setEditingPeriod(null); }}
          period={editingPeriod}
          onSaved={refresh}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Replace RSC page**

Replace the entire content of `src/app/admin/management/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { findActiveBoardPeriod } from "@/lib/management/active-period";
import { ManagementHubPage } from "@/components/admin/management-hub-page";

export default async function AdminManagementPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const periods = await prisma.boardPeriod.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      label: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { assignments: true } },
    },
  });

  const activePeriod = findActiveBoardPeriod(periods, new Date());

  return (
    <ManagementHubPage
      periods={periods.map((p) => ({
        id: p.id,
        label: p.label,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        assignmentCount: p._count.assignments,
      }))}
      activePeriodId={activePeriod?.id ?? null}
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/management-hub-page.tsx src/app/admin/management/page.tsx
git commit -m "feat(admin): management hub page with period list and CRUD"
```

---

## Task 3: Member form dialog

**Files:**
- Create: `src/components/admin/management-member-form-dialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  createManagementMember,
  deleteManagementMember,
  updateManagementMember,
} from "@/lib/actions/admin-management-members";
import {
  adminManagementMemberCreateSchema,
  adminManagementMemberUpdateSchema,
} from "@/lib/forms/admin-management-member-schema";

type MasterMemberOption = { id: string; memberNumber: string; fullName: string };

type MemberRow = {
  id: string;
  fullName: string;
  publicCode: string;
  whatsapp: string | null;
  masterMemberId: string | null;
};

type FormValues = {
  id?: string;
  fullName: string;
  publicCode: string;
  whatsapp: string;
  masterMemberId: string;
};

const NO_LINK = "__none__";

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: MemberRow | null;
  availableMasterMembers: MasterMemberOption[];
  onSaved: () => void;
};

export function ManagementMemberFormDialog({
  mode,
  open,
  onOpenChange,
  member,
  availableMasterMembers,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(
    () => ({
      id: member?.id,
      fullName: member?.fullName ?? "",
      publicCode: member?.publicCode ?? "",
      whatsapp: member?.whatsapp ?? "",
      masterMemberId: member?.masterMemberId ?? NO_LINK,
    }),
    [member],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(
      (mode === "create"
        ? adminManagementMemberCreateSchema
        : adminManagementMemberUpdateSchema) as never,
    ) as Resolver<FormValues>,
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setRootMessage(null);
      setShowDeleteConfirm(false);
      setDeleteError(null);
    }
  }, [open, defaultValues, form]);

  function submit(values: FormValues) {
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      const masterMemberId =
        values.masterMemberId === NO_LINK ? null : values.masterMemberId;
      const payload =
        mode === "create"
          ? {
              fullName: values.fullName,
              publicCode: values.publicCode,
              whatsapp: values.whatsapp,
              masterMemberId,
            }
          : {
              id: member?.id ?? "",
              fullName: values.fullName,
              publicCode: values.publicCode,
              whatsapp: values.whatsapp,
              masterMemberId,
            };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createManagementMember(undefined, fd)
          : await updateManagementMember(undefined, fd);
      if (!result.ok) {
        for (const [f, m] of Object.entries(result.fieldErrors ?? {}))
          form.setError(f as keyof FormValues, { message: m });
        setRootMessage(result.rootError ?? "Terjadi kesalahan.");
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  function handleDelete() {
    if (!member) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: member.id }));
      const result = await deleteManagementMember(undefined, fd);
      if (!result.ok) {
        setDeleteError(result.rootError ?? "Gagal menghapus pengurus.");
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) { setRootMessage(null); setDeleteError(null); setShowDeleteConfirm(false); }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah pengurus" : "Edit pengurus"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Tambahkan ManagementMember baru. Kode publik otomatis diubah ke huruf kapital."
              : "Perbarui data ManagementMember. Kode publik otomatis diubah ke huruf kapital."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          <Field label="Nama lengkap" htmlFor="mm-full-name" error={form.formState.errors.fullName?.message}>
            <Input id="mm-full-name" disabled={isPending} {...form.register("fullName")} />
          </Field>

          <Field label="Kode publik" htmlFor="mm-public-code" error={form.formState.errors.publicCode?.message}>
            <Input
              id="mm-public-code"
              disabled={isPending}
              className="font-mono uppercase"
              placeholder="cth: AF2025"
              {...form.register("publicCode")}
            />
          </Field>

          <Field label="WhatsApp (opsional)" htmlFor="mm-whatsapp" error={form.formState.errors.whatsapp?.message}>
            <Input id="mm-whatsapp" disabled={isPending} placeholder="6281234567890" {...form.register("whatsapp")} />
          </Field>

          <Field label="Tautan anggota (opsional)" htmlFor="mm-master-member" error={form.formState.errors.masterMemberId?.message}>
            <Controller
              control={form.control}
              name="masterMemberId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_LINK}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="mm-master-member">
                    <SelectValue placeholder="Tidak ditautkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LINK}>Tidak ditautkan</SelectItem>
                    {availableMasterMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.memberNumber} — {m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === "edit" && !showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Hapus
              </Button>
            ) : null}
            {mode === "edit" && showDeleteConfirm ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-sm text-destructive">Yakin hapus?</span>
                <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={handleDelete}>
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Ya, hapus"}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={isDeleting} onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}>
                  Batal
                </Button>
              </div>
            ) : null}
            {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, error, children }: {
  label: string; htmlFor: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/management-member-form-dialog.tsx
git commit -m "feat(admin): management member form dialog (create/edit/delete)"
```

---

## Task 4: Members page

**Files:**
- Create: `src/components/admin/management-members-page.tsx`
- Create: `src/app/admin/management/members/page.tsx`

- [ ] **Step 1: Create client component**

```tsx
// src/components/admin/management-members-page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagementMemberFormDialog } from "@/components/admin/management-member-form-dialog";

type MemberRow = {
  id: string;
  fullName: string;
  publicCode: string;
  whatsapp: string | null;
  masterMemberId: string | null;
  masterMember: { memberNumber: string } | null;
};

type MasterMemberOption = { id: string; memberNumber: string; fullName: string };

type Props = {
  members: MemberRow[];
  availableMasterMembers: MasterMemberOption[];
};

export function ManagementMembersPage({ members, availableMasterMembers }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/admin/management" className="hover:text-foreground">
          ← Kepengurusan
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daftar Pengurus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ManagementMember — kode publik digunakan di form pendaftaran acara.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          Belum ada pengurus. Klik "Tambah" untuk menambahkan yang pertama.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kode Publik</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">No. Member</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.fullName}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{m.publicCode}</td>
                  <td className="px-4 py-3">
                    {m.masterMember ? (
                      <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                        {m.masterMember.memberNumber}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${m.fullName}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingMember(m)}>
                          Edit pengurus
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setEditingMember(m)}
                        >
                          Hapus pengurus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManagementMemberFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        availableMasterMembers={availableMasterMembers}
        onSaved={refresh}
      />
      {editingMember ? (
        <ManagementMemberFormDialog
          mode="edit"
          open={Boolean(editingMember)}
          onOpenChange={(open) => { if (!open) setEditingMember(null); }}
          member={editingMember}
          availableMasterMembers={availableMasterMembers}
          onSaved={refresh}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Create RSC page**

```tsx
// src/app/admin/management/members/page.tsx
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { ManagementMembersPage } from "@/components/admin/management-members-page";

export default async function AdminManagementMembersPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const [members, availableMasterMembers] = await Promise.all([
    prisma.managementMember.findMany({
      include: { masterMember: { select: { memberNumber: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.masterMember.findMany({
      where: { isActive: true },
      select: { id: true, memberNumber: true, fullName: true },
      orderBy: { memberNumber: "asc" },
    }),
  ]);

  return (
    <ManagementMembersPage
      members={members}
      availableMasterMembers={availableMasterMembers}
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/management-members-page.tsx src/app/admin/management/members/page.tsx
git commit -m "feat(admin): management members page with CRUD"
```

---

## Task 5: Role form dialog

**Files:**
- Create: `src/components/admin/management-role-form-dialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBoardRole,
  deactivateBoardRole,
  updateBoardRole,
} from "@/lib/actions/admin-board-roles";
import {
  adminBoardRoleCreateSchema,
  adminBoardRoleUpdateSchema,
} from "@/lib/forms/admin-board-role-schema";

type RoleRow = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

type FormValues = {
  id?: string;
  title: string;
  sortOrder: string;
};

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRow | null;
  onSaved: () => void;
};

export function ManagementRoleFormDialog({
  mode,
  open,
  onOpenChange,
  role,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, startDeactivateTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(
    () => ({
      id: role?.id,
      title: role?.title ?? "",
      sortOrder: String(role?.sortOrder ?? 0),
    }),
    [role],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(
      (mode === "create"
        ? adminBoardRoleCreateSchema
        : adminBoardRoleUpdateSchema) as never,
    ) as Resolver<FormValues>,
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setRootMessage(null);
      setDeactivateError(null);
      setShowDeactivateConfirm(false);
    }
  }, [open, defaultValues, form]);

  function submit(values: FormValues) {
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      const payload =
        mode === "create"
          ? { title: values.title, sortOrder: Number(values.sortOrder) }
          : { id: role?.id ?? "", title: values.title, sortOrder: Number(values.sortOrder) };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createBoardRole(undefined, fd)
          : await updateBoardRole(undefined, fd);
      if (!result.ok) {
        for (const [f, m] of Object.entries(result.fieldErrors ?? {}))
          form.setError(f as keyof FormValues, { message: m });
        setRootMessage(result.rootError ?? "Terjadi kesalahan.");
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  function handleDeactivate() {
    if (!role) return;
    setDeactivateError(null);
    startDeactivateTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: role.id }));
      const result = await deactivateBoardRole(undefined, fd);
      if (!result.ok) {
        setDeactivateError(result.rootError ?? "Gagal menonaktifkan jabatan.");
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  const canDeactivate = mode === "edit" && role?.isActive;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) { setRootMessage(null); setDeactivateError(null); setShowDeactivateConfirm(false); }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah jabatan" : "Edit jabatan"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Tambahkan BoardRole baru ke daftar jabatan."
              : "Perbarui nama dan urutan jabatan."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          <Field label="Nama jabatan" htmlFor="role-title" error={form.formState.errors.title?.message}>
            <Input id="role-title" disabled={isPending} {...form.register("title")} />
          </Field>

          <Field label="Urutan tampil" htmlFor="role-sort-order" error={form.formState.errors.sortOrder?.message}>
            <Input id="role-sort-order" type="number" disabled={isPending} {...form.register("sortOrder")} />
          </Field>

          {deactivateError ? (
            <p className="text-sm text-destructive">{deactivateError}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            {canDeactivate && !showDeactivateConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeactivating}
                onClick={() => setShowDeactivateConfirm(true)}
              >
                Nonaktifkan
              </Button>
            ) : null}
            {canDeactivate && showDeactivateConfirm ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-sm text-destructive">Yakin nonaktifkan?</span>
                <Button type="button" variant="destructive" size="sm" disabled={isDeactivating} onClick={handleDeactivate}>
                  {isDeactivating ? <Loader2 className="size-4 animate-spin" /> : "Ya"}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={isDeactivating} onClick={() => { setShowDeactivateConfirm(false); setDeactivateError(null); }}>
                  Batal
                </Button>
              </div>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, error, children }: {
  label: string; htmlFor: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/management-role-form-dialog.tsx
git commit -m "feat(admin): management role form dialog (create/edit/deactivate)"
```

---

## Task 6: Roles page

**Files:**
- Create: `src/components/admin/management-roles-page.tsx`
- Create: `src/app/admin/management/roles/page.tsx`

- [ ] **Step 1: Create client component**

```tsx
// src/components/admin/management-roles-page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagementRoleFormDialog } from "@/components/admin/management-role-form-dialog";
import { cn } from "@/lib/utils";

type RoleRow = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  roles: RoleRow[];
};

export function ManagementRolesPage({ roles }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/admin/management" className="hover:text-foreground">
          ← Kepengurusan
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jabatan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            BoardRole — nama jabatan dan urutan tampil di roster.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah
        </Button>
      </div>

      {roles.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          Belum ada jabatan. Klik "Tambah" untuk menambahkan yang pertama.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama Jabatan</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Urutan</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roles.map((r) => (
                <tr key={r.id} className={cn("hover:bg-muted/30", !r.isActive && "opacity-60")}>
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.sortOrder}</td>
                  <td className="px-4 py-3">
                    {r.isActive ? (
                      <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Nonaktif
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${r.title}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingRole(r)}>
                          Edit jabatan
                        </DropdownMenuItem>
                        {r.isActive ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setEditingRole(r)}
                            >
                              Nonaktifkan
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManagementRoleFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />
      {editingRole ? (
        <ManagementRoleFormDialog
          mode="edit"
          open={Boolean(editingRole)}
          onOpenChange={(open) => { if (!open) setEditingRole(null); }}
          role={editingRole}
          onSaved={refresh}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Create RSC page**

```tsx
// src/app/admin/management/roles/page.tsx
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { ManagementRolesPage } from "@/components/admin/management-roles-page";

export default async function AdminManagementRolesPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const roles = await prisma.boardRole.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, sortOrder: true, isActive: true },
  });

  return <ManagementRolesPage roles={roles} />;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/management-roles-page.tsx src/app/admin/management/roles/page.tsx
git commit -m "feat(admin): management roles page with CRUD"
```

---

## Task 7: Assignment form dialog

**Files:**
- Create: `src/components/admin/management-assignment-form-dialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBoardAssignment,
  deleteBoardAssignment,
  updateBoardAssignment,
} from "@/lib/actions/admin-board-assignments";
import {
  adminBoardAssignmentUpsertSchema,
  adminBoardAssignmentUpdateSchema,
} from "@/lib/forms/admin-board-assignment-schema";

type MemberOption = { id: string; fullName: string; publicCode: string };
type RoleOption = { id: string; title: string };

type AssignmentRow = {
  id: string;
  boardRole: { id: string; title: string };
  managementMember: { id: string; fullName: string; publicCode: string };
};

type CreateProps = {
  mode: "create";
  boardPeriodId: string;
  availableMembers: MemberOption[];
  availableRoles: RoleOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

type EditProps = {
  mode: "edit";
  boardPeriodId: string;
  assignment: AssignmentRow;
  availableRoles: RoleOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

type Props = CreateProps | EditProps;

type CreateFormValues = {
  boardPeriodId: string;
  managementMemberId: string;
  boardRoleId: string;
};

type EditFormValues = {
  id: string;
  boardPeriodId: string;
  managementMemberId: string;
  boardRoleId: string;
};

export function ManagementAssignmentFormDialog(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const defaultValues = useMemo(() => {
    if (props.mode === "create") {
      return {
        boardPeriodId: props.boardPeriodId,
        managementMemberId: "",
        boardRoleId: "",
      } as CreateFormValues;
    }
    return {
      id: props.assignment.id,
      boardPeriodId: props.boardPeriodId,
      managementMemberId: props.assignment.managementMember.id,
      boardRoleId: props.assignment.boardRole.id,
    } as EditFormValues;
  }, [props]);

  const schema =
    props.mode === "create"
      ? adminBoardAssignmentUpsertSchema
      : adminBoardAssignmentUpdateSchema;

  const form = useForm({
    resolver: zodResolver(schema as never) as Resolver<CreateFormValues | EditFormValues>,
    defaultValues: defaultValues as CreateFormValues | EditFormValues,
  });

  useEffect(() => {
    if (props.open) {
      form.reset(defaultValues as CreateFormValues | EditFormValues);
      setRootMessage(null);
      setShowDeleteConfirm(false);
      setDeleteError(null);
    }
  }, [props.open, defaultValues, form]);

  function submit(values: CreateFormValues | EditFormValues) {
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(values));
      const result =
        props.mode === "create"
          ? await createBoardAssignment(undefined, fd)
          : await updateBoardAssignment(undefined, fd);
      if (!result.ok) {
        setRootMessage(result.rootError ?? "Terjadi kesalahan.");
        return;
      }
      props.onOpenChange(false);
      props.onSaved();
    });
  }

  function handleDelete() {
    if (props.mode !== "edit") return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: props.assignment.id }));
      const result = await deleteBoardAssignment(undefined, fd);
      if (!result.ok) {
        setDeleteError(result.rootError ?? "Gagal menghapus penugasan.");
        return;
      }
      props.onOpenChange(false);
      props.onSaved();
    });
  }

  const availableRoles = props.availableRoles;
  const availableMembers = props.mode === "create" ? props.availableMembers : [];

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) { setRootMessage(null); setDeleteError(null); setShowDeleteConfirm(false); }
        props.onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "Tambah penugasan" : "Ubah jabatan"}
          </DialogTitle>
          <DialogDescription>
            {props.mode === "create"
              ? "Pilih pengurus dan jabatan untuk periode ini."
              : `Ganti jabatan untuk ${props.assignment.managementMember.fullName}.`}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit as never)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          {props.mode === "create" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="assign-member">Pengurus</Label>
              <Controller
                control={form.control}
                name="managementMemberId"
                render={({ field, fieldState }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                      <SelectTrigger id="assign-member">
                        <SelectValue placeholder="Pilih pengurus..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName} ({m.publicCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error ? (
                      <p className="text-xs text-destructive">{fieldState.error.message}</p>
                    ) : null}
                  </>
                )}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label>Pengurus</Label>
              <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {props.assignment.managementMember.fullName}{" "}
                <span className="font-mono text-muted-foreground">
                  ({props.assignment.managementMember.publicCode})
                </span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="assign-role">Jabatan</Label>
            <Controller
              control={form.control}
              name="boardRoleId"
              render={({ field, fieldState }) => (
                <>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                    <SelectTrigger id="assign-role">
                      <SelectValue placeholder="Pilih jabatan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error ? (
                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                  ) : null}
                </>
              )}
            />
          </div>

          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

          <DialogFooter className="gap-2 sm:gap-0">
            {props.mode === "edit" && !showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Hapus penugasan
              </Button>
            ) : null}
            {props.mode === "edit" && showDeleteConfirm ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-sm text-destructive">Yakin hapus?</span>
                <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={handleDelete}>
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Ya, hapus"}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={isDeleting} onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}>
                  Batal
                </Button>
              </div>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending} onClick={() => props.onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/management-assignment-form-dialog.tsx
git commit -m "feat(admin): management assignment form dialog (create/edit/delete)"
```

---

## Task 8: Period detail page (roster)

**Files:**
- Create: `src/components/admin/management-period-detail.tsx`
- Modify: `src/app/admin/management/[periodId]/page.tsx`

- [ ] **Step 1: Create client component**

```tsx
// src/components/admin/management-period-detail.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagementAssignmentFormDialog } from "@/components/admin/management-assignment-form-dialog";

type AssignmentRow = {
  id: string;
  boardRole: { id: string; title: string };
  managementMember: { id: string; fullName: string; publicCode: string; masterMemberId: string | null };
};

type MemberOption = { id: string; fullName: string; publicCode: string };
type RoleOption = { id: string; title: string };

type Props = {
  period: { id: string; label: string; startsAt: Date; endsAt: Date };
  assignments: AssignmentRow[];
  availableMembers: MemberOption[];
  availableRoles: RoleOption[];
  isActive: boolean;
};

export function ManagementPeriodDetail({
  period,
  assignments,
  availableMembers,
  availableRoles,
  isActive,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRow | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/admin/management" className="hover:text-foreground">
          ← Kepengurusan
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{period.label}</h1>
            {isActive ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Aktif
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {period.startsAt.toISOString().slice(0, 10)} → {period.endsAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah Penugasan
        </Button>
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          Belum ada penugasan. Klik "Tambah Penugasan" untuk mengisi roster periode ini.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Jabatan</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama Pengurus</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kode Publik</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{a.boardRole.title}</td>
                  <td className="px-4 py-3">
                    {a.managementMember.fullName}
                    {a.managementMember.masterMemberId ? (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">· direktori</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {a.managementMember.publicCode}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${a.managementMember.fullName}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingAssignment(a)}>
                          Ubah jabatan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setEditingAssignment(a)}
                        >
                          Hapus penugasan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <ManagementAssignmentFormDialog
          mode="create"
          boardPeriodId={period.id}
          availableMembers={availableMembers}
          availableRoles={availableRoles}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={refresh}
        />
      ) : null}
      {editingAssignment ? (
        <ManagementAssignmentFormDialog
          mode="edit"
          boardPeriodId={period.id}
          assignment={editingAssignment}
          availableRoles={availableRoles}
          open={Boolean(editingAssignment)}
          onOpenChange={(open) => { if (!open) setEditingAssignment(null); }}
          onSaved={refresh}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Replace RSC page**

Replace the entire content of `src/app/admin/management/[periodId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { findActiveBoardPeriod } from "@/lib/management/active-period";
import { ManagementPeriodDetail } from "@/components/admin/management-period-detail";

export default async function AdminManagementPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const { periodId } = await params;

  const [period, availableMembers, availableRoles, allPeriods] =
    await Promise.all([
      prisma.boardPeriod.findUnique({
        where: { id: periodId },
        select: {
          id: true,
          label: true,
          startsAt: true,
          endsAt: true,
          assignments: {
            include: {
              managementMember: {
                select: { id: true, fullName: true, publicCode: true, masterMemberId: true },
              },
              boardRole: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.managementMember.findMany({
        select: { id: true, fullName: true, publicCode: true },
        orderBy: { fullName: "asc" },
      }),
      prisma.boardRole.findMany({
        where: { isActive: true },
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.boardPeriod.findMany({
        select: { id: true, startsAt: true, endsAt: true },
      }),
    ]);

  if (!period) notFound();

  const activePeriod = findActiveBoardPeriod(allPeriods, new Date());

  return (
    <ManagementPeriodDetail
      period={{
        id: period.id,
        label: period.label,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      }}
      assignments={period.assignments}
      availableMembers={availableMembers}
      availableRoles={availableRoles}
      isActive={activePeriod?.id === period.id}
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test 2>&1 | tail -20
```

Expected: all tests pass (no new failures).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/management-period-detail.tsx "src/app/admin/management/[periodId]/page.tsx"
git commit -m "feat(admin): management period detail page with roster and assignment CRUD"
```

---

## Plan self-review

**Spec coverage:**
- §4 Hub page → Tasks 1–2 ✅
- §5 Period roster → Tasks 7–8 ✅
- §6 Members page → Tasks 3–4 ✅
- §7 Roles page → Tasks 5–6 ✅
- §8 Form pattern (RHF + zodResolver + FormData JSON) → all dialog tasks ✅
- §9 Error handling (rootMessage + fieldErrors) → all dialog tasks ✅
- Auth gate `hasOperationalOwnerParity` → all RSC pages ✅
- Breadcrumb `← Kepengurusan` → Tasks 4, 6, 8 ✅
- Badge "Aktif" on active period → Tasks 2, 8 ✅
- Badge "direktori" on roster rows → Task 8 ✅
- `router.refresh()` after mutations → all client components ✅

**Placeholder scan:** No TBD, no "implement later", no vague steps. All code blocks are complete.

**Type consistency:**
- `PeriodRow` defined in Task 1 and reused in Task 2 — shapes match ✅
- `AssignmentRow` defined in Task 7 and reused in Task 8 — shapes match ✅
- `MemberOption` / `RoleOption` defined in Task 7 and reused in Task 8 — match ✅
- `MasterMemberOption` defined in Task 3 and reused in Task 4 — match ✅
- `RoleRow` defined in Task 5 and reused in Task 6 — match ✅
- All server action signatures: `(undefined, fd)` — consistent throughout ✅
