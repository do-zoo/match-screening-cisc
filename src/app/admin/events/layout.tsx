import { Suspense } from "react";

import { AdminEventsIndexFlashHandler } from "@/components/admin/admin-events-index-flash-handler";

export default function AdminEventsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminEventsIndexFlashHandler />
      </Suspense>
      {children}
    </>
  );
}
