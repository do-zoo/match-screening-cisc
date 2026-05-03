"use client";

import { useState, useTransition } from "react";
import { MemberValidation, TicketPriceType, TicketRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { overrideMemberValidation } from "@/lib/actions/member-validation";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";

type Ticket = {
  id: string;
  role: TicketRole;
  ticketPriceType: TicketPriceType;
};

type Props = {
  eventId: string;
  registrationId: string;
  current: MemberValidation;
  primaryTicket: Ticket | null;
  ticketMemberPriceApplied: number;
  ticketNonMemberPriceApplied: number;
};

const VALIDATION_LABELS: Record<MemberValidation, string> = {
  unknown: "Belum diverifikasi",
  valid: "Valid (member terkonfirmasi)",
  invalid: "Tidak valid (bukan member)",
  overridden: "Override manual",
};

export function MemberValidationPanel({
  eventId,
  registrationId,
  current,
  primaryTicket,
  ticketMemberPriceApplied,
  ticketNonMemberPriceApplied,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [validation, setValidation] = useState<MemberValidation>(current);
  const [newPriceType, setNewPriceType] = useState<TicketPriceType | "">(
    primaryTicket?.ticketPriceType ?? "",
  );
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await overrideMemberValidation(eventId, registrationId, {
        validation,
        newPrimaryPriceType: newPriceType || undefined,
      });
      if (!res.ok) {
        toastActionErr(res);
        setError(res.rootError ?? "Terjadi kesalahan.");
      } else {
        const msg = res.data.adjustmentCreated
          ? "Validasi diperbarui. Penyesuaian invoice kekurangan dibuat otomatis."
          : "Validasi diperbarui.";
        toastCudSuccess("update", msg);
        setResult(msg);
      }
    });
  }

  const delta =
    newPriceType === TicketPriceType.non_member && primaryTicket?.ticketPriceType === TicketPriceType.member
      ? ticketNonMemberPriceApplied - ticketMemberPriceApplied
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validasi member</CardTitle>
        <CardDescription>
          Status saat ini: <strong>{VALIDATION_LABELS[current]}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Status validasi</label>
            <Select
              value={validation}
              onValueChange={(v) => setValidation(v as MemberValidation)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VALIDATION_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {primaryTicket && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Tipe harga tiket utama</label>
              <Select
                value={newPriceType}
                onValueChange={(v) => setNewPriceType(v as TicketPriceType)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TicketPriceType.member}>Member</SelectItem>
                  <SelectItem value={TicketPriceType.non_member}>Non-member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {delta > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Perubahan ini akan membuat invoice kekurangan sebesar{" "}
            <strong>
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(delta)}
            </strong>{" "}
            secara otomatis.
          </p>
        )}

        {result && <p className="text-sm text-emerald-700">{result}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave} disabled={isPending} className="w-full sm:w-auto">
          Simpan perubahan validasi
        </Button>
      </CardContent>
    </Card>
  );
}
