"use client";

import { useRouter } from "next/navigation";

import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildEventRegistrantsListUrl,
  type EventRegistrantsTab,
} from "@/lib/admin/event-registrants-list-url";
import type { EventsIndexViewMode } from "@/lib/admin/events-index-view";

const tabOptions: { tab: EventRegistrantsTab; label: string }[] = [
  { tab: "all", label: "Semua status" },
  { tab: "pending_review", label: "Menunggu tinjauan" },
  { tab: "submitted", label: "Terkirim" },
  { tab: "payment_issue", label: "Masalah pembayaran" },
  { tab: "approved", label: "Disetujui" },
  { tab: "rejected", label: "Ditolak" },
  { tab: "closed", label: "Dibatalkan / refund" },
];

export function AdminEventRegistrantsToolbar({
  eventId,
  tab,
  viewMode,
  searchQuery,
}: {
  eventId: string;
  tab: EventRegistrantsTab;
  viewMode: EventsIndexViewMode;
  searchQuery: string;
}) {
  const router = useRouter();

  return (
    <AdminListToolbar
      search={{
        inputId: "admin-event-registrants-search",
        label: "Cari peserta",
        placeholder: "Nama, WhatsApp, atau nomor anggota…",
        value: searchQuery,
        getUrlForQuery: (q) =>
          buildEventRegistrantsListUrl(eventId, {
            tab,
            view: viewMode,
            q,
            page: 1,
          }),
      }}
      viewToggle={{
        mode: viewMode,
        tableHref: buildEventRegistrantsListUrl(eventId, {
          tab,
          view: "table",
          q: searchQuery.trim() || undefined,
          page: 1,
        }),
        cardsHref: buildEventRegistrantsListUrl(eventId, {
          tab,
          view: "cards",
          q: searchQuery.trim() || undefined,
          page: 1,
        }),
      }}
      filterSlot={
        <>
          <Label
            htmlFor="admin-event-registrants-tab"
            className="text-muted-foreground text-xs"
          >
            Status pendaftaran
          </Label>
          <Select
            value={tab}
            onValueChange={(v) => {
              if (!v) return;
              router.push(
                buildEventRegistrantsListUrl(eventId, {
                  tab: v as EventRegistrantsTab,
                  view: viewMode,
                  q: searchQuery.trim() || undefined,
                  page: 1,
                }),
              );
            }}
          >
            <SelectTrigger
              id="admin-event-registrants-tab"
              size="sm"
              className="w-full min-w-0 sm:w-56"
            >
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
        </>
      }
    />
  );
}
