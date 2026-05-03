"use client";

import { useState, useTransition } from "react";
import { RegistrationStatus } from "@prisma/client";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelRegistration, refundRegistration } from "@/lib/actions/cancel-refund";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";

type Props = {
  eventId: string;
  registrationId: string;
  status: RegistrationStatus;
};

const CANCEL_BLOCKED_FROM = new Set<RegistrationStatus>([
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
  RegistrationStatus.rejected,
]);

const REFUND_ALLOWED_FROM = new Set<RegistrationStatus>([
  RegistrationStatus.approved,
  RegistrationStatus.cancelled,
]);

export function CancelRefundPanel({ eventId, registrationId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = !CANCEL_BLOCKED_FROM.has(status);
  const canRefund = REFUND_ALLOWED_FROM.has(status);

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelRegistration(eventId, registrationId);
      if (!result.ok) {
        toastActionErr(result);
        setError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        toastCudSuccess("update", "Pendaftaran dibatalkan.");
        setCancelOpen(false);
      }
    });
  }

  function handleRefund() {
    setError(null);
    startTransition(async () => {
      const result = await refundRegistration(eventId, registrationId);
      if (!result.ok) {
        toastActionErr(result);
        setError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        toastCudSuccess("update", "Pengembalian dana dicatat.");
        setRefundOpen(false);
      }
    });
  }

  if (!canCancel && !canRefund) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batalkan / Refund</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger disabled={isPending} render={<Button variant="outline" />}>
                Batalkan pendaftaran
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Konfirmasi pembatalan</DialogTitle>
                  <DialogDescription>
                    Pendaftaran ini akan diubah ke status <strong>cancelled</strong>. Aksi ini tidak dapat dibatalkan secara otomatis.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
                    Kembali
                  </Button>
                  <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
                    Ya, batalkan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canRefund && (
            <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
              <DialogTrigger disabled={isPending} render={<Button variant="destructive" />}>
                Proses refund
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Konfirmasi refund</DialogTitle>
                  <DialogDescription>
                    Pendaftaran ini akan diubah ke status <strong>refunded</strong>. Pastikan pembayaran sudah dikembalikan sebelum mengkonfirmasi.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={isPending}>
                    Kembali
                  </Button>
                  <Button variant="destructive" onClick={handleRefund} disabled={isPending}>
                    Ya, proses refund
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
