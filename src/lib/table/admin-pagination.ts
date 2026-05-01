/** Rows per admin data table page (events index, inbox, members). */

export const ADMIN_TABLE_PAGE_SIZE = 20;

function firstString(
  param: string | string[] | undefined,
): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

export function parseAdminTablePage(
  raw: string | string[] | undefined,
): number {
  const v = firstString(raw);
  if (v === undefined || v === "") return 1;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function resolveClampedPage(
  requestedPage: number,
  totalItems: number,
  pageSize: number,
): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const p =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.floor(requestedPage)
      : 1;
  return Math.min(p, totalPages);
}
