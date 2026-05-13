"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGridIcon, Table2Icon } from "lucide-react";

import type { EventsIndexViewMode } from "@/lib/admin/events-index-view";
import {
  buildAdminVenuesIndexUrl,
  type VenuesIndexTab,
} from "@/lib/admin/admin-venues-index";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 350;

const tabOptions: { tab: VenuesIndexTab; label: string }[] = [
  { tab: "all", label: "Semua venue" },
  { tab: "active", label: "Aktif" },
  { tab: "inactive", label: "Tidak aktif" },
];

export function AdminVenuesIndexToolbar({
  tab,
  viewMode,
  searchQuery,
}: {
  tab: VenuesIndexTab;
  viewMode: EventsIndexViewMode;
  searchQuery: string;
}) {
  const router = useRouter();
  const [draftQ, setDraftQ] = React.useState(searchQuery);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron input ke `searchParams.q`
    setDraftQ(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    const trimmed = draftQ.trim();
    const nextQ = trimmed.length > 0 ? trimmed : undefined;
    const currentTrimmed = searchQuery.trim();
    const currentQ = currentTrimmed.length > 0 ? currentTrimmed : undefined;
    if (nextQ === currentQ) return;

    const id = window.setTimeout(() => {
      router.push(
        buildAdminVenuesIndexUrl({
          tab,
          view: viewMode,
          q: nextQ,
        }),
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(id);
  }, [draftQ, searchQuery, tab, viewMode, router]);

  const qForNav = draftQ.trim();
  const qForUrl = qForNav.length > 0 ? qForNav : undefined;

  function push(url: string) {
    router.push(url);
  }

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="admin-venues-search" className="text-muted-foreground text-xs">
              Cari venue
            </Label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <Input
                id="admin-venues-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Nama atau alamat…"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                className="w-full min-w-0"
              />
              {searchQuery.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground shrink-0 self-start sm:self-auto"
                  onClick={() => {
                    setDraftQ("");
                    push(buildAdminVenuesIndexUrl({ tab, view: viewMode }));
                  }}
                >
                  Hapus filter
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-48">
            <Label htmlFor="admin-venues-tab" className="text-muted-foreground text-xs">
              Status venue
            </Label>
            <Select
              value={tab}
              onValueChange={(v) => {
                if (v === null) return;
                push(
                  buildAdminVenuesIndexUrl({
                    tab: v as VenuesIndexTab,
                    view: viewMode,
                    q: qForUrl,
                  }),
                );
              }}
            >
              <SelectTrigger id="admin-venues-tab" size="sm" className="w-full min-w-0 sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabOptions.map(({ tab: key, label }) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className="bg-muted/60 flex shrink-0 rounded-lg border p-0.5 sm:ml-auto"
            role="group"
            aria-label="Bentuk daftar venue"
          >
            <Link
              href={buildAdminVenuesIndexUrl({ tab, view: "cards", q: qForUrl })}
              aria-label="Tampilan kartu"
              title="Tampilan kartu"
              className={cn(
                buttonVariants({
                  variant: viewMode === "cards" ? "secondary" : "ghost",
                  size: "icon-sm",
                  className: "size-8 rounded-md shadow-none",
                }),
              )}
            >
              <LayoutGridIcon className="size-4" />
            </Link>
            <Link
              href={buildAdminVenuesIndexUrl({ tab, view: "table", q: qForUrl })}
              aria-label="Tampilan tabel"
              title="Tampilan tabel"
              className={cn(
                buttonVariants({
                  variant: viewMode === "table" ? "secondary" : "ghost",
                  size: "icon-sm",
                  className: "size-8 rounded-md shadow-none",
                }),
              )}
            >
              <Table2Icon className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
