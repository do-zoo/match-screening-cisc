import { APIError } from "better-auth";

import { prisma } from "@/lib/db/prisma";

/** Single message whether the email is missing or not an admin — limits account enumeration. */
const MAGIC_LINK_NOT_ALLOWED_MSG =
  "Email tidak terdaftar sebagai admin. Gunakan email akun admin yang sudah ada.";

/**
 * Ensures magic link is only sent for emails that already belong to an admin user.
 * Call from `sendMagicLink` before sending mail.
 */
export async function assertAdminMagicLinkEmail(email: string): Promise<void> {
  const trimmed = email.trim();
  const user = await prisma.user.findFirst({
    where: { email: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) {
    throw new APIError("BAD_REQUEST", { message: MAGIC_LINK_NOT_ALLOWED_MSG });
  }
  const admin = await prisma.adminProfile.findUnique({
    where: { authUserId: user.id },
    select: { id: true },
  });
  if (!admin) {
    throw new APIError("BAD_REQUEST", { message: MAGIC_LINK_NOT_ALLOWED_MSG });
  }
}
