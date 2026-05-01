import type { PrismaClient } from "@prisma/client";

/**
 * Produce URL-safe ASCII slug segments from Indonesian / Latin titles (no diacritics).
 */
export function slugifyEventTitle(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96);
}

/** Returns unique slug by appending `-2`, `-3`, … against `prisma.event`. */
export async function allocateUniqueEventSlug(
  prisma: PrismaClient,
  title: string,
): Promise<string> {
  const base = slugifyEventTitle(title);
  const head = base.length > 0 ? base : "acara";

  let candidate = head;
  let n = 1;
  while (true) {
    const clash = await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${head}-${n}`;
  }
}
