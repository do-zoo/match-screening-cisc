"use client";

import { useState, useTransition } from "react";
import { TicketRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { redeemVoucher } from "@/lib/actions/voucher-redemption";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";

type Ticket = {
  id: string;
  role: TicketRole;
  fullName: string;
  voucherRedeemedMenuItemId: string | null;
  voucherRedeemedAt: Date | null;
};

type MenuItem = { id: string; name: string; price: number; voucherEligible: boolean };

type Props = {
  eventId: string;
  tickets: Ticket[];
  menuItems: MenuItem[];
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function VoucherRedemptionPanel({ eventId, tickets, menuItems }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleRedeem(ticketId: string) {
    const menuItemId = selections[ticketId];
    if (!menuItemId) {
      setErrors((prev) => ({ ...prev, [ticketId]: "Pilih menu item terlebih dahulu." }));
      return;
    }
    setErrors((prev) => ({ ...prev, [ticketId]: "" }));
    startTransition(async () => {
      const result = await redeemVoucher(eventId, ticketId, menuItemId);
      if (!result.ok) {
        toastActionErr(result);
        const msg: string = result.rootError ?? "Terjadi kesalahan.";
        setErrors((prev) => ({ ...prev, [ticketId]: msg }));
      } else {
        toastCudSuccess("update", "Voucher berhasil ditukar.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penukaran voucher menu</CardTitle>
        <CardDescription>Pilih menu untuk setiap tiket voucher yang belum ditukarkan.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="text-sm font-medium">{ticket.fullName} ({ticket.role})</div>
            {ticket.voucherRedeemedMenuItemId ? (
              <p className="text-sm text-emerald-700">
                ✓ Sudah ditukar ·{" "}
                {ticket.voucherRedeemedAt
                  ? new Date(ticket.voucherRedeemedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })
                  : ""}
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={selections[ticket.id] ?? ""}
                  onValueChange={(v) => { if (v !== null) setSelections((prev) => ({ ...prev, [ticket.id]: v })); }}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Pilih menu…" />
                  </SelectTrigger>
                  <SelectContent>
                    {menuItems.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} — {idr(m.price)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => handleRedeem(ticket.id)} disabled={isPending}>
                  Tukarkan
                </Button>
              </div>
            )}
            {errors[ticket.id] && <p className="text-sm text-destructive">{errors[ticket.id]}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
