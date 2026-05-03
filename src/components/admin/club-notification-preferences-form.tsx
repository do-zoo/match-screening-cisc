"use client";

import { useActionState, useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

import type { NotificationOutboundMode } from "@prisma/client";

import { saveClubNotificationPreferences } from "@/lib/actions/admin-club-notification-preferences";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

const OUTBOUND_MODE_OPTIONS: Array<{
  value: NotificationOutboundMode;
  label: string;
}> = [
  { value: "off", label: "Mati — tidak log jalur outbound" },
  { value: "log_only", label: "Log saja — catat di konsol (disarankan dev)" },
  { value: "live", label: "Live — log + jalur penyedia (wire-up terpisah)" },
];

function OutboundModeSelectField(props: {
  initialMode: NotificationOutboundMode;
  pending: boolean;
}) {
  const [mode, setMode] = useState(props.initialMode);

  return (
    <>
      <input type="hidden" name="outboundMode" value={mode} />
      <Select
        value={mode}
        onValueChange={(v) => {
          if (v != null) setMode(v as NotificationOutboundMode);
        }}
        disabled={props.pending}
      >
        <SelectTrigger id="outboundMode" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OUTBOUND_MODE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

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
          <OutboundModeSelectField
            key={props.initialMode}
            initialMode={props.initialMode}
            pending={pending}
          />
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
