import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClubAuditRowVm } from "@/lib/audit/load-recent-club-audit";

export function ClubAuditLogTable(props: { rows: ClubAuditRowVm[] }) {
  if (props.rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada peristiwa audit tercatat.
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
