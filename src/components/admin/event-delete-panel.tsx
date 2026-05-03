"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteAdminEvent } from "@/lib/actions/admin-events";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import type { ActionResult } from "@/lib/forms/action-result";

type Props = {
  eventId: string;
  eventTitle: string;
  registrationCount: number;
};

export function EventDeletePanel({
  eventId,
  eventTitle,
  registrationCount,
}: Props) {
  const router = useRouter();
  const [state, dispatch, isPending] = useActionState(
    deleteAdminEvent,
    null as ActionResult<{ deleted: true }> | null,
  );

  useEffect(() => {
    if (state?.ok) {
      toastCudSuccess("delete", "Acara berhasil dihapus.");
      router.push("/admin/events");
    }
  }, [state, router]);

  useEffect(() => {
    if (state?.ok === false) toastActionErr(state);
  }, [state]);

  return (
    <section className="rounded-lg border border-destructive/40 p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-destructive">Zona berbahaya</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tindakan di bawah ini bersifat permanen dan tidak bisa dibatalkan.
        </p>
      </div>

      {registrationCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          Acara tidak bisa dihapus karena memiliki{" "}
          <strong>{registrationCount} registrasi</strong>. Hapus atau batalkan semua
          registrasi terlebih dahulu jika ingin menghapus acara ini.
        </p>
      ) : (
        <Dialog>
          <DialogTrigger
            disabled={isPending}
            render={<Button variant="destructive" className="w-fit" />}
          >
            Hapus acara
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus acara</DialogTitle>
              <DialogDescription>
                Menghapus <strong>{eventTitle}</strong> secara permanen beserta semua
                konfigurasinya. Tindakan ini tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {state?.ok === false && state.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{state.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={dispatch}>
              <input type="hidden" name="eventId" value={eventId} />
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Ya, hapus acara"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
