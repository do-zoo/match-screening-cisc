"use client";

import { useActionState } from "react";

import { WaTemplateKey } from "@prisma/client";

import {
  resetClubWaTemplateBody,
  saveClubWaTemplateBody,
} from "@/lib/actions/admin-club-wa-templates";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/forms/action-result";
import { CLUB_WA_DEFAULT_BODIES } from "@/lib/wa-templates/db-default-template-bodies";
import { REQUIRED_TOKENS } from "@/lib/wa-templates/wa-template-policy";

const ORDER: WaTemplateKey[] = [
  WaTemplateKey.receipt,
  WaTemplateKey.approved,
  WaTemplateKey.rejected,
  WaTemplateKey.payment_issue,
  WaTemplateKey.cancelled,
  WaTemplateKey.refunded,
  WaTemplateKey.underpayment_invoice,
];

const LABELS: Record<WaTemplateKey, string> = {
  receipt: "Penerimaan pendaftaran",
  approved: "Disetujui",
  rejected: "Ditolak",
  payment_issue: "Masalah pembayaran",
  cancelled: "Dibatalkan",
  refunded: "Refunded",
  underpayment_invoice: "Tagihan kekurangan bayar",
};

export function ClubWaTemplatesPanel(props: {
  initialFromDb: Partial<Record<WaTemplateKey, string>>;
}) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Tubuh pesan menggunakan placeholder dalam kurung seperti{" "}
        <code className="text-xs">{`{contact_name}`}</code>. Jika Anda menyimpan salah sintaks,
        tautan akan kembali ke teks bawaan aplikasi. Placeholder tidak boleh menambahkan nama baru di
        luar yang wajib.
      </p>
      <div className="flex flex-col gap-8">
        {ORDER.map((key) => (
          <ClubWaTemplateKeyCard key={key} waKey={key} displayDb={props.initialFromDb[key]} />
        ))}
      </div>
    </div>
  );
}

function ClubWaTemplateKeyCard(props: {
  waKey: WaTemplateKey;
  displayDb?: string;
}) {
  const { waKey } = props;
  const defaults = REQUIRED_TOKENS[waKey].map((t) => `{${t}}`).join(", ");
  const display = props.displayDb ?? CLUB_WA_DEFAULT_BODIES[waKey];

  const initialState = null as ActionResult<{ saved: true }> | null;
  const [saveState, saveDispatch, savePending] = useActionState(
    saveClubWaTemplateBody,
    initialState,
  );
  const [resetState, resetDispatch, resetPending] = useActionState(
    resetClubWaTemplateBody,
    initialState,
  );

  function mutationErrorAlerts(s: Exclude<ActionResult<{ saved: true }>, { ok: true }>) {
    return (
      <>
        {s.rootError ? (
          <Alert variant="destructive">
            <AlertTitle>Gagal</AlertTitle>
            <AlertDescription>{s.rootError}</AlertDescription>
          </Alert>
        ) : null}
        {s.fieldErrors?.body ? (
          <Alert variant="destructive">
            <AlertTitle>Periksa isian</AlertTitle>
            <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
              {s.fieldErrors.body}
            </AlertDescription>
          </Alert>
        ) : null}
      </>
    );
  }

  const combinedPending = savePending || resetPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{LABELS[waKey]}</CardTitle>
        <CardDescription>
          Wajib mencakup minimal: <span className="font-mono text-xs">{defaults}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saveState?.ok === false ? mutationErrorAlerts(saveState) : null}
        {resetState?.ok === false ? mutationErrorAlerts(resetState) : null}
        <form action={saveDispatch} className="space-y-3">
          <input type="hidden" name="key" value={waKey} />
          <Textarea
            id={`wa-${waKey}`}
            name="body"
            required
            defaultValue={display}
            rows={12}
            className="font-mono text-xs md:text-sm"
            disabled={combinedPending}
          />
          <Button type="submit" disabled={combinedPending}>
            Simpan
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-start border-t pt-4">
        <form action={resetDispatch}>
          <input type="hidden" name="key" value={waKey} />
          <Button type="submit" variant="outline" size="sm" disabled={combinedPending}>
            Reset ke bawaan
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
