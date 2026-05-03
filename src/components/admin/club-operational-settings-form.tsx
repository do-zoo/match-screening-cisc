"use client";

import { useActionState, useEffect } from "react";

import { Loader2 } from "lucide-react";

import { saveClubOperationalSettings } from "@/lib/actions/admin-club-operational-settings";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

export function ClubOperationalSettingsForm(props: {
  initialRegistrationGloballyDisabled: boolean;
  initialGlobalRegistrationClosedMessage: string;
  initialMaintenanceBannerPlainText: string;
}) {
  const [state, dispatch, pending] = useActionState(
    saveClubOperationalSettings,
    null as ActionResult<{ saved: true }> | null,
  );

  useEffect(() => {
    if (state?.ok) {
      toastCudSuccess("update", "Pengaturan operasional berhasil disimpan.");
    }
  }, [state]);

  return (
    <div className="max-w-xl space-y-6">
      {state?.ok === false && state.rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{state.rootError}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok === false && state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertTitle>Periksa isian</AlertTitle>
          <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
            {Object.entries(state.fieldErrors)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n")}
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={dispatch} className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <input
              id="registrationGloballyDisabled"
              type="checkbox"
              name="registrationGloballyDisabled"
              value="on"
              defaultChecked={props.initialRegistrationGloballyDisabled}
              disabled={pending}
              className="mt-1 size-4 shrink-0 rounded border border-input"
            />
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="registrationGloballyDisabled"
                className="cursor-pointer leading-snug font-medium"
              >
                Tutup pendaftaran untuk semua acara (situs publik)
              </Label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Pengunjung tidak dapat mengirim pendaftaran baru meskipun acara
                masih dibuka secara per‑acara.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="globalRegistrationClosedMessage">
            Pesan saat tutup global (opsional)
          </Label>
          <Textarea
            id="globalRegistrationClosedMessage"
            name="globalRegistrationClosedMessage"
            rows={3}
            placeholder="Kosongkan untuk memakai teks bawaan aplikasi."
            defaultValue={props.initialGlobalRegistrationClosedMessage}
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">
            Hanya dipakai ketika kotak penutupan global di atas dicentang. Teks
            polos, tanpa markup.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="maintenanceBannerPlainText">
            Banner pemeliharaan di situs pengunjung (opsional)
          </Label>
          <Textarea
            id="maintenanceBannerPlainText"
            name="maintenanceBannerPlainText"
            rows={3}
            placeholder="Misalnya jadwal maintenance atau pengumuman singkat."
            defaultValue={props.initialMaintenanceBannerPlainText}
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">
            Ditampilkan di bagian atas halaman publik. Kosongkan untuk
            menyembunyikan.
          </p>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Menyimpan…
            </>
          ) : (
            "Simpan"
          )}
        </Button>
      </form>
      {state?.ok === true ? (
        <p className="text-sm font-medium text-emerald-600">Pengaturan disimpan.</p>
      ) : null}
    </div>
  );
}
