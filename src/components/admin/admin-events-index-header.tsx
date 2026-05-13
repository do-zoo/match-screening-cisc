import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function AdminEventsIndexHeader({
  sessionEmail,
  isOps,
}: {
  sessionEmail: string | null | undefined;
  isOps: boolean;
}) {
  return (
    <header className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Acara</h1>
        {isOps ? (
          <Link
            href="/admin/events/new"
            className={buttonVariants({
              variant: "default",
              size: "sm",
              className: "shrink-0 sm:self-center",
            })}
          >
            Buat acara
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {sessionEmail ? (
          <>
            Anda masuk sebagai{" "}
            <span className="font-medium text-foreground">{sessionEmail}</span>. Pilih status acara,
            bentuk daftar (kartu atau tabel), lalu kelola registrasi.
          </>
        ) : (
          <>Pilih status acara, bentuk daftar, lalu kelola registrasi.</>
        )}
      </p>
    </header>
  );
}
