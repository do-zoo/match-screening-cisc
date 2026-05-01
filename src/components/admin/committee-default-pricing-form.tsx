"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCommitteeDefaultTicketPrices } from "@/lib/actions/admin-committee-pricing";
import type { CommitteeTicketDefaultPrices } from "@/lib/events/event-admin-defaults";
import { committeeDefaultPricingFormSchema } from "@/lib/forms/committee-default-pricing-schema";
import type { ActionResult } from "@/lib/forms/action-result";

export function CommitteeDefaultPricingForm(props: {
  initial: CommitteeTicketDefaultPrices & { persisted: boolean };
}) {
  const [state, dispatch, pending] = useActionState(
    saveCommitteeDefaultTicketPrices,
    null as ActionResult<{ saved: true }> | null,
  );

  const fv = committeeDefaultPricingFormSchema.safeParse({
    ticketMemberPrice: props.initial.ticketMemberPrice,
    ticketNonMemberPrice: props.initial.ticketNonMemberPrice,
  });

  const defaultMember = fv.success
    ? fv.data.ticketMemberPrice
    : props.initial.ticketMemberPrice;
  const defaultNonMember = fv.success
    ? fv.data.ticketNonMemberPrice
    : props.initial.ticketNonMemberPrice;

  const fieldLines =
    state?.ok === false && state.fieldErrors
      ? Object.entries(state.fieldErrors)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : null;

  return (
    <form action={dispatch} className="max-w-md space-y-4">
      {state?.ok === false && state.rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{state.rootError}</AlertDescription>
        </Alert>
      ) : null}
      {fieldLines ? (
        <Alert variant="destructive">
          <AlertTitle>Periksa isian</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
            {fieldLines}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="committee-default-member-idr">Tiket member (IDR)</Label>
        <Input
          id="committee-default-member-idr"
          name="ticketMemberPrice"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={defaultMember}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="committee-default-nonmember-idr">Tiket non-member (IDR)</Label>
        <Input
          id="committee-default-nonmember-idr"
          name="ticketNonMemberPrice"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={defaultNonMember}
          disabled={pending}
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
      {props.initial.persisted ? (
        <p className="text-muted-foreground text-xs">
          Nilai tersimpan di basis data. Jika baris dihapus manual lewat SQL, nilai akan jatuh ke env
          lalu ke fallback bawaan aplikasi (lihat <code>MATCH_DEFAULT_TICKET_*_IDR</code>).
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Belum ada baris penyimpanan: tampilan saat ini memakai env atau fallback sampai Anda
          menyimpan sekali di sini.
        </p>
      )}
      {state?.ok === true ? (
        <p className="text-sm font-medium text-emerald-600">Tersimpan.</p>
      ) : null}
    </form>
  );
}
