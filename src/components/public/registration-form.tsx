"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";

import { submitRegistration } from "@/lib/actions/submit-registration";
import {
  submitRegistrationFormSchema,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";
import type { ActionResult } from "@/lib/forms/action-result";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { PriceBreakdown } from "@/components/public/price-breakdown";
import type { SerializedEventForRegistration } from "@/components/public/event-serialization";

type Props = {
  event: SerializedEventForRegistration;
};

type SubmitRegistrationUiErrors = SubmitRegistrationInput & {
  transferProof?: unknown;
  memberCardPhoto?: unknown;
};

const submitRegistrationResolver = zodResolver(
  submitRegistrationFormSchema as never,
) as Resolver<SubmitRegistrationUiErrors>;

export function RegistrationForm({ event }: Props) {
  const router = useRouter();

  const form = useForm<SubmitRegistrationUiErrors>({
    resolver: submitRegistrationResolver,
    defaultValues: {
      slug: event.slug,
      contactName: "",
      contactWhatsapp: "",
      claimedMemberNumber: undefined,
      qtyPartner: 0,
      partnerName: "",
      partnerWhatsapp: "",
      partnerMemberNumber: "",
      selectedMenuItemIds:
        event.menuSelection === "SINGLE"
          ? event.menuItems[0]
            ? [event.menuItems[0].id]
            : []
          : [],
    },
    mode: "onChange",
  });

  const watched = useWatch({ control: form.control });
  const selectedMenuIds = useMemo(
    () => (watched.selectedMenuItemIds ?? []).filter(Boolean),
    [watched.selectedMenuItemIds],
  );
  const claimedMemberTrim = String(watched.claimedMemberNumber ?? "").trim();

  const pricingPreview = useMemo(() => {
    const qtyPartnerNorm: 0 | 1 =
      Number(watched.qtyPartner ?? 0) === 1 ? 1 : 0;
    const includePartner = qtyPartnerNorm === 1;

    try {
      if (event.menuMode === "VOUCHER") {
        if (event.voucherPrice == null) {
          return null;
        }
        const menuParts: Parameters<
          typeof computeSubmitTotal
        >[0]["perTicketMenu"] = [{ mode: "VOUCHER" }];
        if (includePartner) menuParts.push({ mode: "VOUCHER" });

        return computeSubmitTotal({
          event: {
            ticketMemberPrice: event.ticketMemberPrice,
            ticketNonMemberPrice: event.ticketNonMemberPrice,
            menuMode: event.menuMode,
            voucherPrice: event.voucherPrice,
          },
          primaryPriceType: watched.claimedMemberNumber?.trim()
            ? "member"
            : "non_member",
          includePartner,
          perTicketMenu: menuParts,
        });
      }

      const items = event.menuItems.filter((m) =>
        selectedMenuIds.includes(m.id),
      );

      const menuParts: Parameters<
        typeof computeSubmitTotal
      >[0]["perTicketMenu"] = [
        {
          mode: "PRESELECT",
          selectedMenuItems: items.map((m) => ({ price: m.price })),
        },
      ];

      if (includePartner) {
        menuParts.push({
          mode: "PRESELECT",
          selectedMenuItems: items.map((m) => ({ price: m.price })),
        });
      }

      return computeSubmitTotal({
        event: {
          ticketMemberPrice: event.ticketMemberPrice,
          ticketNonMemberPrice: event.ticketNonMemberPrice,
          menuMode: event.menuMode,
          voucherPrice: event.voucherPrice,
        },
        primaryPriceType: watched.claimedMemberNumber?.trim()
          ? "member"
          : "non_member",
        includePartner,
        perTicketMenu: menuParts,
      });
    } catch {
      return null;
    }
  }, [
    event,
    selectedMenuIds,
    watched.claimedMemberNumber,
    watched.qtyPartner,
  ]);

  async function submitWithFiles(values: SubmitRegistrationInput, files: Files) {
    const fd = new FormData();
    fd.set("slug", values.slug);
    fd.set("contactName", values.contactName);
    fd.set("contactWhatsapp", values.contactWhatsapp);

    fd.set(
      "claimedMemberNumber",
      values.claimedMemberNumber?.trim() ?? "",
    );
    fd.set("qtyPartner", String(values.qtyPartner));

    fd.set("partnerName", values.partnerName?.trim() ?? "");
    fd.set("partnerWhatsapp", values.partnerWhatsapp?.trim() ?? "");
    fd.set("partnerMemberNumber", values.partnerMemberNumber?.trim() ?? "");

    for (const id of values.selectedMenuItemIds ?? []) {
      if (id) fd.append("selectedMenuItemIds", id);
    }

    fd.set("transferProof", files.transferProof);
    const memberCard = files.memberCard;
    if (memberCard) {
      fd.set("memberCardPhoto", memberCard);
    }

    const result: ActionResult<{ registrationId: string }> =
      await submitRegistration(null, fd);

    if (result.ok) {
      router.push(`/e/${event.slug}/r/${result.data.registrationId}`);
      return;
    }

    form.clearErrors("root.server");
    form.clearErrors([
      "transferProof",
      "memberCardPhoto",
      "partnerName",
      "partnerWhatsapp",
      "partnerMemberNumber",
      "selectedMenuItemIds",
    ]);

    if (result.rootError) {
      form.setError("root.server", { message: result.rootError });
    }

    const fe = result.fieldErrors;
    if (!fe) return;

    for (const [key, msg] of Object.entries(fe)) {
      form.setError(key as keyof SubmitRegistrationUiErrors, { message: msg });
    }
  }

  return (
    <Form {...form}>
      <form
        className="mx-auto flex w-full max-w-2xl flex-col gap-6"
        encType="multipart/form-data"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit((values) => {
            const formEl = e.currentTarget;
            const transferProofEl = formEl.elements.namedItem(
              "transferProof",
            ) as HTMLInputElement | null;
            const transferProofFile = transferProofEl?.files?.[0];

            const memberCardEl = formEl.elements.namedItem(
              "memberCardPhoto",
            ) as HTMLInputElement | null;
            const memberCardFile = memberCardEl?.files?.[0] ?? undefined;

            if (!transferProofFile) {
              form.setError("root.transferProofMissing", {
                message: "Unggah bukti transfer wajib.",
              });
              return;
            }

            form.clearErrors("root.transferProofMissing");
            form.clearErrors("root.server");

            return void submitWithFiles(values, {
              transferProof: transferProofFile,
              memberCard: memberCardFile,
            });
          })();
        }}
      >
        <input type="hidden" name="slug" value={event.slug} readOnly />

        <div className="flex flex-col gap-1">
          <div className="font-semibold text-lg">{event.title}</div>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            {event.venueName} ·{" "}
            {new Date(event.startAtIso).toLocaleString("id-ID", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </div>
        </div>

        <section className="grid gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="font-medium">Informasi pemesan</div>

          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nama</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactWhatsapp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WhatsApp</FormLabel>
                <FormControl>
                  <Input inputMode="tel" autoComplete="tel" {...field} />
                </FormControl>
                <FormDescription>
                  Gunakan nomor utama yang bisa dihubungi via WhatsApp.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="claimedMemberNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor member (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: CISC-xxxx" {...field} />
                </FormControl>
                <FormDescription>
                  Jika diisi, harga akan mengikuti harga member.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

        </section>

        <section className="grid gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="font-medium">Pembayaran</div>
          </div>

          <div className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            Transfer ke:{" "}
            <span className="font-medium text-foreground">{event.bankAccount.bankName}</span>{" "}
            — {event.bankAccount.accountName}{" "}
            <span className="font-mono">{event.bankAccount.accountNumber}</span>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="transferProof">
              Bukti transfer
            </label>
            <Input id="transferProof" name="transferProof" type="file" accept="image/*" />
            {form.formState.errors.root?.transferProofMissing ? (
              <p className="text-sm font-medium text-[hsl(var(--destructive))]">
                {String(form.formState.errors.root.transferProofMissing.message)}
              </p>
            ) : null}
            {form.formState.errors.transferProof?.message ? (
              <p className="text-sm font-medium text-[hsl(var(--destructive))]">
                {String(form.formState.errors.transferProof.message)}
              </p>
            ) : null}
          </div>

          {claimedMemberTrim.length > 0 ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="memberCardPhoto">
                Foto kartu member
              </label>
              <Input
                id="memberCardPhoto"
                name="memberCardPhoto"
                type="file"
                accept="image/*"
              />
              {form.formState.errors.memberCardPhoto?.message ? (
                <p className="text-sm font-medium text-[hsl(var(--destructive))]">
                  {String(form.formState.errors.memberCardPhoto.message)}
                </p>
              ) : null}
            </div>
          ) : null}

          <PriceBreakdown event={event} pricing={pricingPreview} />
        </section>

        {event.menuMode === "PRESELECT" ? (
          <section className="grid gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="font-medium">
              Menu {event.menuSelection === "SINGLE" ? "(pilih satu)" : "(pilih minimal satu)"}
            </div>

            <div className="grid gap-3">
              {event.menuItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-md border border-[hsl(var(--border))] p-3"
                >
                  <div className="grid gap-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {idr(item.price)}{" "}
                      {item.voucherEligible ? "· boleh voucher" : null}
                    </div>
                  </div>

                  {event.menuSelection === "SINGLE" ? (
                    <input
                      type="radio"
                      name="menuSingle"
                      value={item.id}
                      checked={selectedMenuIds.includes(item.id)}
                      onChange={() => {
                        form.setValue("selectedMenuItemIds", [item.id], {
                          shouldValidate: true,
                        });
                      }}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedMenuIds.includes(item.id)}
                      onChange={(e) => {
                        const current = new Set(
                          form.getValues("selectedMenuItemIds") ?? [],
                        );
                        if (e.target.checked) current.add(item.id);
                        else current.delete(item.id);
                        form.setValue("selectedMenuItemIds", [...current], {
                          shouldValidate: true,
                        });
                      }}
                    />
                  )}
                </label>
              ))}
            </div>

            <FormField
              control={form.control}
              name="selectedMenuItemIds"
              render={() => <FormMessage />}
            />
          </section>
        ) : null}

        <section className="grid gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <FormField
            control={form.control}
            name="qtyPartner"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-md border border-[hsl(var(--border))] p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Bawa tiket partner</FormLabel>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    Hanya untuk pengurus (nomor member utama akan divalidasi).
                  </div>
                </div>
                <FormControl>
                  <input
                    type="checkbox"
                    checked={Number(field.value) === 1}
                    onChange={(e) =>
                      field.onChange(e.target.checked ? 1 : 0)
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {Number(watched.qtyPartner ?? 0) === 1 ? (
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="partnerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama partner</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="partnerWhatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp partner (opsional)</FormLabel>
                    <FormControl>
                      <Input inputMode="tel" autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="partnerMemberNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor member partner (opsional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: CISC-xxxx" {...field} />
                    </FormControl>
                    <FormDescription>
                      Jika sama dengan member utama akan ditolak.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}
        </section>

        {form.formState.errors.root?.server ? (
          <p className="text-sm font-medium text-[hsl(var(--destructive))]">
            {String(form.formState.errors.root.server.message)}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full">
          Kirim pendaftaran
        </Button>
      </form>
    </Form>
  );
}

type Files = {
  transferProof: File;
  memberCard?: File;
};

function idr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
