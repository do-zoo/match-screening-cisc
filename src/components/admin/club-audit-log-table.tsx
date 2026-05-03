import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ClubAuditLogDateTimeField } from "@/components/admin/club-audit-log-datetime-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import type { ClubAuditRowVm } from "@/lib/audit/load-recent-club-audit";
import { CLUB_AUDIT_PAGE_SIZE } from "@/lib/audit/load-recent-club-audit";

import { ClubAuditLogActionSelect } from "@/components/admin/club-audit-log-action-select";

export function ClubAuditLogFilters(props: {
  from: string;
  to: string;
  action: string;
  userId: string;
  actionOptions: readonly string[];
  securityPath: string;
}) {
  return (
    <form
      method="get"
      action={props.securityPath}
      className="flex flex-col gap-4 rounded-lg border bg-card/30 p-4"
    >
      <input type="hidden" name="page" value="1" />
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <ClubAuditLogDateTimeField
            id="audit-from"
            name="from"
            label="Dari tanggal & waktu"
            defaultValue={props.from}
          />
          <ClubAuditLogDateTimeField
            id="audit-to"
            name="to"
            label="Sampai tanggal & waktu"
            defaultValue={props.to}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="audit-action">Aksi</Label>
            <ClubAuditLogActionSelect
              id="audit-action"
              defaultAction={props.action}
              options={props.actionOptions}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-user">User ID (auth)</Label>
            <Input
              id="audit-user"
              name="userId"
              type="search"
              placeholder="Substring cocok"
              defaultValue={props.userId}
              maxLength={200}
              className="w-full font-mono text-xs"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Terapkan filter
        </Button>
        <Link
          href={props.securityPath}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Reset
        </Link>
      </div>
    </form>
  );
}

export function ClubAuditLogTable(props: {
  rows: ClubAuditRowVm[];
  emptyMessage?: string;
}) {
  if (props.rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {props.emptyMessage ?? "Belum ada peristiwa audit tercatat."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Waktu (UTC)</TableHead>
            <TableHead>Aksi</TableHead>
            <TableHead>Sasaran</TableHead>
            <TableHead>Aktor (auth user id)</TableHead>
            <TableHead>Metadata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs whitespace-nowrap">
                {r.createdAtIso}
              </TableCell>
              <TableCell className="font-mono text-xs">{r.action}</TableCell>
              <TableCell className="font-mono text-xs">
                {r.targetType ?? "—"}
                {r.targetId ? ` / ${r.targetId}` : ""}
              </TableCell>
              <TableCell className="max-w-[140px] truncate font-mono text-xs">
                {r.actorAuthUserId}
              </TableCell>
              <TableCell className="max-w-md font-mono text-[11px] break-all text-muted-foreground">
                {r.metadata == null ? "—" : JSON.stringify(r.metadata)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function buildAdminProfileAuditExportHref(filters: {
  from: string;
  to: string;
}): string {
  const p = new URLSearchParams();
  p.set("actionPrefix", "admin_profile.");
  const fromTrim = filters.from.trim();
  const toTrim = filters.to.trim();
  if (fromTrim) p.set("from", fromTrim);
  if (toTrim) p.set("to", toTrim);
  return `/admin/settings/security/audit-export?${p.toString()}`;
}

const SECURITY_PATH = "/admin/settings/security";

export function ClubAuditLogSection(props: {
  rows: ClubAuditRowVm[];
  totalItems: number;
  page: number;
  filters: {
    from: string;
    to: string;
    action: string;
    userId: string;
  };
  actionOptions: readonly string[];
}) {
  const hasActiveFilters = Boolean(
    props.filters.from ||
      props.filters.to ||
      props.filters.action ||
      props.filters.userId,
  );

  const preservedQuery: Record<string, string | undefined> = {};
  if (props.filters.from) preservedQuery.from = props.filters.from;
  if (props.filters.to) preservedQuery.to = props.filters.to;
  if (props.filters.action) preservedQuery.action = props.filters.action;
  if (props.filters.userId) preservedQuery.userId = props.filters.userId;

  return (
    <div className="space-y-4">
      <ClubAuditLogFilters
        from={props.filters.from}
        to={props.filters.to}
        action={props.filters.action}
        userId={props.filters.userId}
        actionOptions={props.actionOptions}
        securityPath={SECURITY_PATH}
      />
      <div>
        <Link
          href={buildAdminProfileAuditExportHref(props.filters)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Unduh CSV (aksi profil admin, maks. 10.000 baris)
        </Link>
      </div>
      <ClubAuditLogTable
        rows={props.rows}
        emptyMessage={
          hasActiveFilters
            ? "Tidak ada entri audit yang cocok dengan filter."
            : undefined
        }
      />
      <TablePagination
        pathname={SECURITY_PATH}
        preservedQuery={preservedQuery}
        currentPage={props.page}
        pageSize={CLUB_AUDIT_PAGE_SIZE}
        totalItems={props.totalItems}
      />
    </div>
  );
}
