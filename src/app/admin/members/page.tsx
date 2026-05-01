import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { MembersAdminPage } from "@/components/admin/members-admin-page";
import { buildMasterMemberCsvTemplate } from "@/lib/members/master-member-csv-template";
import {
  countMasterMembersByTabForAdmin,
  countMasterMembersForAdmin,
  listMasterMembersForAdmin,
} from "@/lib/members/query-admin-master-members";
import {
  ADMIN_TABLE_PAGE_SIZE,
  parseAdminTablePage,
  resolveClampedPage,
} from "@/lib/table/admin-pagination";

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

function parseFilter(v: string | undefined): "all" | "active" | "inactive" {
  if (v === "active" || v === "inactive") return v;
  return "all";
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const sp = (await searchParams) ?? {};
  const filter = parseFilter(firstString(sp.filter));
  const qRaw = firstString(sp.q) ?? "";
  const q = qRaw.trim().slice(0, 200) || undefined;

  const csvTemplateText = buildMasterMemberCsvTemplate();
  const requestedPage = parseAdminTablePage(sp.page);

  const totalItems = await countMasterMembersForAdmin({ filter, q });
  const page = resolveClampedPage(
    requestedPage,
    totalItems,
    ADMIN_TABLE_PAGE_SIZE,
  );
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

  const [rows, counts] = await Promise.all([
    listMasterMembersForAdmin({
      filter,
      q,
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
    }),
    countMasterMembersByTabForAdmin({ q }),
  ]);

  return (
    <MembersAdminPage
      csvTemplateText={csvTemplateText}
      rows={rows}
      pagination={{
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        totalItems,
      }}
      filter={filter}
      searchQuery={q ?? ""}
      tabCounts={counts}
    />
  );
}
