"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { VenueCatalogUiPayload } from "@/lib/forms/venue-catalog-form-schema";
import { venueCatalogPayloadSchema } from "@/lib/forms/venue-catalog-form-schema";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import { saveVenueCatalog } from "@/lib/actions/admin-venues";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function VenueCatalogEditor({
  venueId,
  initial,
}: {
  venueId: string;
  initial: VenueCatalogUiPayload;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState(initial.name);
  const [address, setAddress] = React.useState(initial.address);
  const [items, setItems] = React.useState(initial.items);

  function addRow() {
    setItems((prev) => [
      ...prev,
      {
        name: "",
        price: 0,
        sortOrder: prev.length + 1,
        voucherEligible: true,
      },
    ]);
  }

  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    startTransition(async () => {
      const parsed = venueCatalogPayloadSchema.safeParse({
        name,
        address,
        items,
      });
      if (!parsed.success) {
        toast.error("Isi formulir tidak valid.");
        return;
      }

      const res = await saveVenueCatalog(
        venueId,
        parsed.data,
      );

      if (res.ok) {
        toastCudSuccess("update", "Venue & menu disimpan.");
        router.refresh();
      } else {
        toastActionErr(res);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label htmlFor="vName">Nama venue</Label>
        <Input
          id="vName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vAddr">Alamat</Label>
        <Textarea
          id="vAddr"
          rows={3}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Menu kanonik</h2>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={addRow}>
            Tambah baris
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((row, index) => (
            <div
              key={row.id ?? `new_${index}`}
              className="bg-card grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-12"
            >

              <div className="col-span-full sm:col-span-2 lg:col-span-6">
                <Label className="text-xs">Nama</Label>
                <Input
                  value={row.name}
                  onChange={(e) =>
                    setItems((prev) => {
                      const next = [...prev];
                      next[index] = {
                        ...next[index]!,
                        name: e.target.value,
                      };
                      return next;
                    })
                  }
                  disabled={pending}
                />
              </div>
              <div className="lg:col-span-2">
                <Label className="text-xs">Harga IDR</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.price}
                  onChange={(e) =>
                    setItems((prev) => {
                      const next = [...prev];
                      next[index] = {
                        ...next[index]!,
                        price: Number.parseInt(e.target.value || "0", 10),
                      };
                      return next;
                    })
                  }
                  disabled={pending}
                />
              </div>
              <div className="lg:col-span-2">
                <Label className="text-xs">Urutan</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.sortOrder}
                  onChange={(e) =>
                    setItems((prev) => {
                      const next = [...prev];
                      next[index] = {
                        ...next[index]!,
                        sortOrder: Number.parseInt(e.target.value || "0", 10),
                      };
                      return next;
                    })
                  }
                  disabled={pending}
                />
              </div>
              <label className="flex items-center gap-2 lg:col-span-2 lg:self-end lg:pb-2">
                <input
                  type="checkbox"
                  checked={row.voucherEligible}
                  onChange={(e) =>
                    setItems((prev) => {
                      const next = [...prev];
                      next[index] = {
                        ...next[index]!,
                        voucherEligible: e.target.checked,
                      };
                      return next;
                    })
                  }
                  disabled={pending}
                />
                <span className="text-sm">Eligible voucher</span>
              </label>
              <div className="col-span-full flex justify-end lg:col-span-full">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || items.length <= 1}
                  onClick={() => removeRow(index)}
                >
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => submit()}>
          Simpan
        </Button>
        <Link href="/admin/venues" className={cn(buttonVariants({ variant: "outline" }), "inline-flex shrink-0")}>
          Batal
        </Link>
      </div>
    </div>
  );
}
