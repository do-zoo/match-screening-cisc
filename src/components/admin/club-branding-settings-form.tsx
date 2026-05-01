"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import { saveClubBranding } from "@/lib/actions/admin-club-branding";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/forms/action-result";

export function ClubBrandingSettingsForm(props: {
  initialClubName: string;
  initialFooter: string;
  logoUrl: string | null;
}) {
  const [state, dispatch, pending] = useActionState(
    saveClubBranding,
    null as ActionResult<{ saved: true }> | null,
  );

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
          <Label htmlFor="clubNameNav">Nama di header publik</Label>
          <Input
            id="clubNameNav"
            name="clubNameNav"
            required
            defaultValue={props.initialClubName}
            disabled={pending}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="footerPlainText">Teks footer (opsional)</Label>
          <Textarea
            id="footerPlainText"
            name="footerPlainText"
            rows={3}
            placeholder="Misalnya hak cipta singkat atau alamat kontak"
            defaultValue={props.initialFooter}
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">
            Ditampilkan sebagai teks polos di bawah halaman publik. Kosongkan untuk
            menyembunyikan footer.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo">Logo klub (opsional, gambar raster)</Label>
          <Input
            id="logo"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={pending}
          />
          {props.logoUrl ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Image
                src={props.logoUrl}
                alt="Pratinjau logo saat ini"
                width={48}
                height={48}
                className="rounded-sm object-contain"
              />
              <span className="text-muted-foreground text-xs">
                Unggah berkas baru untuk mengganti. Lewati jika hanya mengubah teks.
              </span>
            </div>
          ) : null}
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
        <p className="text-sm font-medium text-emerald-600">Branding disimpan.</p>
      ) : null}
    </div>
  );
}
