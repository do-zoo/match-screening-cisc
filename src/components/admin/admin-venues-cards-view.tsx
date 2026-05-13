import Link from "next/link";

import type { VenuesIndexTab } from "@/lib/admin/admin-venues-index";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";

const fmtNum = new Intl.NumberFormat("id-ID");

export type AdminVenueSummaryCard = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  menuItemCount: number;
  eventCount: number;
};

export function AdminVenuesCardsView({
  tab,
  searchQuery,
  venues,
  pagination,
}: {
  tab: VenuesIndexTab;
  searchQuery: string;
  venues: AdminVenueSummaryCard[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
}) {
  return (
    <div className="flex flex-col gap-8">
      {venues.length === 0 ? (
        <div className="text-muted-foreground bg-card rounded-lg border border-dashed p-8 text-center text-sm">
          Tidak ada venue untuk filter ini. Buat venue baru atau ubah filter pencarian.
        </div>
      ) : (
        <>
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {venues.map((v) => (
              <li key={v.id}>
                <Card className="flex h-full flex-col">
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-snug">{v.name}</CardTitle>
                      <Badge variant={v.isActive ? "default" : "secondary"}>
                        {v.isActive ? "Aktif" : "Tidak aktif"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-4 text-sm whitespace-pre-wrap">
                      {v.address}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {fmtNum.format(v.menuItemCount)} menu · digunakan{" "}
                      {fmtNum.format(v.eventCount)} acara
                    </p>
                  </CardHeader>
                  <CardFooter className="mt-auto border-t pt-4">
                    <Link
                      href={`/admin/venues/${v.id}/edit`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Kelola venue
                    </Link>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
          <TablePagination
            pathname="/admin/venues"
            preservedQuery={{
              tab,
              ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
            }}
            currentPage={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            className="bg-card rounded-lg border px-3 py-3"
          />
        </>
      )}
    </div>
  );
}
