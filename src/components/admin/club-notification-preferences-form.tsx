"use client";

import { useActionState, useEffect } from "react";

import { Loader2 } from "lucide-react";
import { saveClubNotificationPreferences } from "@/lib/actions/admin-club-notification-preferences";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

import type { NotificationOutboundMode } from "@prisma/client";

export function ClubNotificationPreferencesForm(props: {
  initialMode: NotificationOutboundMode;
  initialLabel: string;
}) {
  const [state, dispatch, pending] = useActionState(
    saveClubNotificationPreferences,
    null as ActionResult<{ saved: true }> | null,
  );

  useEffect(() => {
    if (state?.ok) {
      toastCudSuccess("update", "Preferensi notifikasi berhasil disimpan.");
    }
  }, [state]);

  return (
    <div className="max-w-xl space-y-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Konfigurasi ini memisahkan{' '}
        <strong>baca tulis preferensi</strong> dari penyedia pengiriman nyata.
        Magic link untuk masuk admin tetap memakai implementasi Better Auth Anda
        (saat ini log konsol).
      </p>

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
          <Label htmlFor="outboundMode">Mode saluran keluar (stub / siap kirim)</Label>
          <select
            id="outboundMode"
            name="outboundMode"
            defaultValue={props.initialMode}
            disabled={pending}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full max-w-md rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="off">Mati — tidak log jalur outbound</option>
            <option value="log_only">Log saja — catat di konsol (disarankan dev)</option>
            <option value="live">
              Live — log + jalur penyedia (wire-up terpisah)
            </option>
          </select>
          <ul className="text-muted-foreground list-inside list-disc text-xs space-y-1">
            <li>
              <span className="font-mono">off</span> — tidak log jalur outbound stub.
            </li>
            <li>
              <span className="font-mono">log_only</span> — catat ke konsol server
              (disarankan untuk dev).
            </li>
            <li>
              <span className="font-mono">live</span> — log + siap sambung penyedia
              luar (wire-up terpisah).
            </li>
          </ul>
          <p className="text-muted-foreground text-xs">
            Mengubah pilihan tidak mengganti penyedia sampai variabel lingkungan dan
            kode kirim ditambahkan.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="outboundLabel">Label internal (opsional)</Label>
          <Input
            id="outboundLabel"
            name="outboundLabel"
            placeholder="Mis. Email komite"
            defaultValue={props.initialLabel}
            disabled={pending}
            maxLength={120}
            autoComplete="off"
          />
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
        <p className="text-sm font-medium text-emerald-600">Preferensi disimpan.</p>
      ) : null}
    </div>
  );
}
