import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { MembersAdminPage } from "@/components/admin/members-admin-page";
import { buildMasterMemberCsvTemplate } from "@/lib/members/master-member-csv-template";
import { listMasterMembersForAdmin } from "@/lib/members/query-admin-master-members";

export default async function AdminAnggotaPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const initialRows = await listMasterMembersForAdmin({
    filter: "all",
    q: undefined,
  });
  const csvTemplateText = buildMasterMemberCsvTemplate();

  return (
    <MembersAdminPage
      initialRows={initialRows}
      csvTemplateText={csvTemplateText}
    />
  );
}
