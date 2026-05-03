import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createVenueMinimal } from "@/lib/actions/admin-venues";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = { title: "Venue baru" };

export default async function AdminNewVenuePage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/venues"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-0")}
        >
          ← Daftar venue
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Venue baru</h1>
      </div>

      <form
        action={async (fd) => {
          await createVenueMinimal(fd);
        }}
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="name">Nama venue</Label>
          <Input id="name" name="name" required autoComplete="off" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="address">Alamat</Label>
          <Textarea id="address" name="address" rows={3} required />
        </div>
        <button
          type="submit"
          className={cn(buttonVariants(), "w-fit")}
        >
          Simpan
        </button>
      </form>
    </main>
  );
}
