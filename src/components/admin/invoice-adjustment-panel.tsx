"use client";

import { useState, useTransition } from "react";
import { InvoiceAdjustmentStatus, InvoiceAdjustmentType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileField } from "@/components/ui/file-field";
import { IdrAmountInput } from "@/components/ui/idr-amount-input";
import { Separator } from "@/components/ui/separator";
import { formatIdr } from "@/lib/utils/format-idr";
import {
  createInvoiceAdjustment,
  markAdjustmentPaid,
  markAdjustmentUnpaid,
} from "@/lib/actions/invoice-adjustment";
import { uploadAdjustmentProof } from "@/lib/actions/upload-adjustment-proof";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";

type Adjustment = {
  id: string;
  type: InvoiceAdjustmentType;
  amount: number;
  status: InvoiceAdjustmentStatus;
  paidAt: Date | null;
  createdAt: Date;
  uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>;
};

type Props = {
  eventId: string;
  registrationId: string;
  adjustments: Adjustment[];
};

export function InvoiceAdjustmentPanel({ eventId, registrationId, adjustments }: Props) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [proofFieldKeyByAdjustment, setProofFieldKeyByAdjustment] = useState<
    Record<string, number>
  >({});

  function handleCreate() {
    setCreateError(null);
    if (!amount || amount <= 0) {
      setCreateError("Masukkan jumlah yang valid.");
      return;
    }
    startTransition(async () => {
      const result = await createInvoiceAdjustment(eventId, {
        registrationId,
        type: InvoiceAdjustmentType.underpayment,
        amount,
      });
      if (!result.ok) {
        toastActionErr(result);
        setCreateError(result.rootError ?? Object.values(result.fieldErrors ?? {}).join(", "));
      } else {
        toastCudSuccess("create", "Penyesuaian invoice ditambahkan.");
        setCreateOpen(false);
        setAmount(0);
      }
    });
  }

  function handleMarkPaid(adjustmentId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await markAdjustmentPaid(eventId, adjustmentId);
      if (!result.ok) {
        toastActionErr(result);
        setActionError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        toastCudSuccess("update", "Penyesuaian ditandai lunas.");
      }
    });
  }

  function handleMarkUnpaid(adjustmentId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await markAdjustmentUnpaid(eventId, adjustmentId);
      if (!result.ok) {
        toastActionErr(result);
        setActionError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        toastCudSuccess("update", "Penyesuaian ditandai belum lunas.");
      }
    });
  }

  function handleUploadProof(adjustmentId: string, file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("adjustmentId", adjustmentId);
    formData.set("file", file);
    setActionError(null);
    startTransition(async () => {
      const result = await uploadAdjustmentProof(eventId, formData);
      if (!result.ok) {
        toastActionErr(result);
        setActionError(result.rootError ?? Object.values(result.fieldErrors ?? {}).join(", "));
      } else {
        toastCudSuccess("update", "Bukti penyesuaian diunggah.");
        setProofFieldKeyByAdjustment((prev) => ({
          ...prev,
          [adjustmentId]: (prev[adjustmentId] ?? 0) + 1,
        }));
      }
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Penyesuaian invoice</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {adjustments.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada penyesuaian.</p>
        )}
        {adjustments.map((adj) => (
          <div key={adj.id} className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{formatIdr(adj.amount)}</span>
              <span className={adj.status === InvoiceAdjustmentStatus.paid ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
                {adj.status === InvoiceAdjustmentStatus.paid ? "Lunas" : "Belum lunas"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {adj.type} · {new Date(adj.createdAt).toLocaleDateString("id-ID")}
            </div>
            {adj.uploads.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {adj.uploads.map((u) => (
                  <a key={u.id} href={u.blobUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs underline text-muted-foreground hover:text-foreground">
                    Bukti ({Math.round(u.bytes / 1024)} KB)
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center mt-1">
              {adj.status === InvoiceAdjustmentStatus.unpaid && (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleMarkPaid(adj.id)}>
                  Tandai lunas
                </Button>
              )}
              {adj.status === InvoiceAdjustmentStatus.paid && (
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleMarkUnpaid(adj.id)}>
                  Batalkan lunas
                </Button>
              )}
              <div className="mt-1 max-w-md">
                <FileField
                  key={`adj-proof-${adj.id}-${proofFieldKeyByAdjustment[adj.id] ?? 0}`}
                  id={`invoice-adj-proof-${adj.id}`}
                  label="Bukti penyesuaian"
                  description="Unggah foto bukti pembayaran tambahan (opsional, dapat beberapa kali)."
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  disabled={isPending}
                  pickPrompt="Ketuk untuk memilih bukti"
                  replacePrompt="Ganti bukti"
                  onChange={(f) => {
                    if (f) handleUploadProof(adj.id, f);
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        <Separator />
        {!createOpen ? (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)} disabled={isPending}>
            + Tambah penyesuaian manual
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Tambah kekurangan pembayaran</p>
            <IdrAmountInput
              value={amount}
              onValueChange={setAmount}
              placeholder="Rp0"
              disabled={isPending}
            />
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={isPending}>Buat penyesuaian</Button>
              <Button size="sm" variant="ghost" disabled={isPending}
                onClick={() => { setCreateOpen(false); setAmount(0); setCreateError(null); }}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
