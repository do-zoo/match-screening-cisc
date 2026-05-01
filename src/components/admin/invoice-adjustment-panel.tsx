"use client";

import { useRef, useState, useTransition } from "react";
import { InvoiceAdjustmentStatus, InvoiceAdjustmentType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  createInvoiceAdjustment,
  markAdjustmentPaid,
  markAdjustmentUnpaid,
} from "@/lib/actions/invoice-adjustment";
import { uploadAdjustmentProof } from "@/lib/actions/upload-adjustment-proof";

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

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function InvoiceAdjustmentPanel({ eventId, registrationId, adjustments }: Props) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleCreate() {
    setCreateError(null);
    const parsed = parseInt(amount.replace(/\D/g, ""), 10);
    if (!parsed || parsed <= 0) { setCreateError("Masukkan jumlah yang valid."); return; }
    startTransition(async () => {
      const result = await createInvoiceAdjustment(eventId, {
        registrationId,
        type: InvoiceAdjustmentType.underpayment,
        amount: parsed,
      });
      if (!result.ok) {
        setCreateError(result.rootError ?? Object.values(result.fieldErrors ?? {}).join(", "));
      } else {
        setCreateOpen(false);
        setAmount("");
      }
    });
  }

  function handleMarkPaid(adjustmentId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await markAdjustmentPaid(eventId, adjustmentId);
      if (!result.ok) setActionError(result.rootError ?? "Terjadi kesalahan.");
    });
  }

  function handleMarkUnpaid(adjustmentId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await markAdjustmentUnpaid(eventId, adjustmentId);
      if (!result.ok) setActionError(result.rootError ?? "Terjadi kesalahan.");
    });
  }

  function handleUploadProof(adjustmentId: string) {
    const input = fileRefs.current[adjustmentId];
    if (!input?.files?.[0]) return;
    const formData = new FormData();
    formData.set("adjustmentId", adjustmentId);
    formData.set("file", input.files[0]);
    setActionError(null);
    startTransition(async () => {
      const result = await uploadAdjustmentProof(eventId, formData);
      if (!result.ok) {
        setActionError(result.rootError ?? Object.values(result.fieldErrors ?? {}).join(", "));
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
              <span className="font-medium">{idr(adj.amount)}</span>
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
              <div className="flex items-center gap-1">
                <input type="file" accept="image/*" className="hidden"
                  ref={(el) => { fileRefs.current[adj.id] = el; }}
                  onChange={() => handleUploadProof(adj.id)} />
                <Button size="sm" variant="ghost" disabled={isPending}
                  onClick={() => fileRefs.current[adj.id]?.click()}>
                  Unggah bukti
                </Button>
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
            <input type="number" min="1" placeholder="Jumlah (IDR)" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm" disabled={isPending} />
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={isPending}>Buat penyesuaian</Button>
              <Button size="sm" variant="ghost" disabled={isPending}
                onClick={() => { setCreateOpen(false); setAmount(""); setCreateError(null); }}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
