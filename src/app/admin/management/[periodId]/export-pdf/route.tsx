import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import {
  listPeriodRolesAsTree,
  type PeriodTreeRow,
} from "@/lib/management/query-admin-period-tree";
import { prisma } from "@/lib/db/prisma";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 40, color: "#111" },
  header: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555" },
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  roleCell: { flex: 2 },
  assigneeCell: { flex: 3, color: "#374151" },
  emptyAssignee: { color: "#9ca3af", fontStyle: "italic" },
});

function OrgDocument({
  periodLabel,
  dateRange,
  rows,
}: {
  periodLabel: string;
  dateRange: string;
  rows: PeriodTreeRow[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Struktur Kepengurusan CISC</Text>
          <Text style={styles.subtitle}>
            Periode: {periodLabel} ({dateRange})
          </Text>
        </View>
        {rows.map((row) => {
          const indent = row.depth * 14;
          const assigneeText =
            row.assignees.length === 0
              ? "(belum diisi)"
              : row.assignees.map((a) => `${a.fullName} (${a.publicCode})`).join(", ");
          return (
            <View key={row.roleId} style={styles.row}>
              <View style={[styles.roleCell, { paddingLeft: indent }]}>
                <Text style={{ fontWeight: row.depth === 0 ? "bold" : "normal" }}>
                  {row.depth > 0 ? "└ " : ""}{row.roleTitle}
                  {!row.roleIsUnique ? " [banyak]" : ""}
                </Text>
              </View>
              <View style={styles.assigneeCell}>
                <Text style={row.assignees.length === 0 ? styles.emptyAssignee : undefined}>
                  {assigneeText}
                </Text>
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params;

  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const period = await prisma.boardPeriod.findUnique({
    where: { id: periodId },
    select: { label: true, startsAt: true, endsAt: true },
  });
  if (!period) return new NextResponse("Not found", { status: 404 });

  const rows = await listPeriodRolesAsTree(periodId);
  const dateRange = `${period.startsAt.toISOString().slice(0, 10)} – ${period.endsAt.toISOString().slice(0, 10)}`;

  const buffer = await renderToBuffer(
    <OrgDocument periodLabel={period.label} dateRange={dateRange} rows={rows} />,
  );

  const filename = `struktur-kepengurusan-${period.label.replace(/\s+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
