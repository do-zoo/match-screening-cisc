"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import {
  venueCatalogPayloadSchema,
  type VenueCatalogUiPayload,
} from "@/lib/forms/venue-catalog-form-schema";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { venueMenuItemIdsFrozenByExistingRegistrations } from "@/lib/venues/venue-menu-frozen-item-ids";

export async function createVenueMinimal(
  formData: FormData,
): Promise<ActionResult<{ venueId: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (name.length < 1)
    return fieldError({ name: "Nama venue wajib diisi." });
  if (address.length < 1)
    return fieldError({ address: "Alamat venue wajib diisi." });

  const venue = await prisma.venue.create({
    data: {
      name,
      address,
      menuItems: {
        create: {
          name:
            "Contoh menu — sesuaikan nama & harga",
          price: 0,
          sortOrder: 1,
          voucherEligible: true,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/admin/venues");

  redirect(`/admin/venues/${venue.id}/edit`);
}

export async function saveVenueCatalog(
  venueId: string,
  payload: unknown,
): Promise<ActionResult<{ venueId: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsed = venueCatalogPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error));
  }

  const p: VenueCatalogUiPayload = parsed.data;
  const { name, address, items } = p;

  if (!items.length) {
    return rootError("Venue minimal memiliki satu item menu dengan nama valid.");
  }

  const frozen = await venueMenuItemIdsFrozenByExistingRegistrations(prisma);

  try {
    await prisma.$transaction(async (tx) => {
      const venueExists = await tx.venue.findUnique({
        where: { id: venueId },
        select: { id: true },
      });
      if (!venueExists) {
        throw new Error("__VENUE_NOT_FOUND__");
      }

      await tx.venue.update({
        where: { id: venueId },
        data: { name, address },
      });

      const existingRows = await tx.venueMenuItem.findMany({
        where: { venueId },
        select: { id: true, name: true, price: true, voucherEligible: true },
      });
      const existingIds = new Set(existingRows.map((r) => r.id));

      const persistedIncomingIds = new Set(
        items.flatMap((it) =>
          typeof it.id === "string" && existingIds.has(it.id) ? [it.id] : [],
        ),
      );

      for (const oldId of existingIds) {
        if (!persistedIncomingIds.has(oldId)) {
          if (frozen.has(oldId)) {
            throw new Error("__VENUE_MENU_DELETE_FROZEN__");
          }
          await tx.venueMenuItem.delete({ where: { id: oldId } });
        }
      }

      for (const row of items) {
        if (
          typeof row.id === "string" &&
          persistedIncomingIds.has(row.id)
        ) {
          if (frozen.has(row.id)) {
            const prev = existingRows.find((x) => x.id === row.id);
            if (
              prev &&
              (prev.name !== row.name.trim() ||
                prev.price !== row.price ||
                prev.voucherEligible !== row.voucherEligible)
            ) {
              throw new Error("__VENUE_MENU_EDIT_FROZEN__");
            }
          }

          await tx.venueMenuItem.update({
            where: { id: row.id },
            data: {
              name: row.name.trim(),
              price: row.price,
              sortOrder: row.sortOrder,
              voucherEligible: row.voucherEligible,
            },
          });
        } else {
          await tx.venueMenuItem.create({
            data: {
              venueId,
              name: row.name.trim(),
              price: row.price,
              sortOrder: row.sortOrder,
              voucherEligible: row.voucherEligible,
            },
          });
        }
      }
    });
  } catch (e) {
    if (typeof e === "object" && e instanceof Error) {
      if (e.message === "__VENUE_NOT_FOUND__") {
        return rootError("Venue tidak ditemukan.");
      }
      if (e.message === "__VENUE_MENU_DELETE_FROZEN__") {
        return rootError(
          "Item menu tidak bisa dihapus karena dipakai acara dengan pendaftaran.",
        );
      }
      if (e.message === "__VENUE_MENU_EDIT_FROZEN__") {
        return rootError(
          "Item menu terkunci — tidak bisa mengubah nama, harga, atau voucher eligible untuk acara yang ada.",
        );
      }
    }
    throw e;
  }

  revalidatePath("/admin/venues");
  revalidatePath(`/admin/venues/${venueId}/edit`);
  revalidatePath("/admin/events");

  return ok({ venueId });
}
