import { prisma } from "@/lib/db/prisma";

const publicActiveEventSelect = {
  slug: true,
  title: true,
  summary: true,
  coverBlobUrl: true,
  startAt: true,
  venue: { select: { name: true } },
} as const;

export type PublicActiveEventRow = {
  slug: string;
  title: string;
  summary: string;
  coverBlobUrl: string;
  startAtIso: string;
  venueName: string;
};

export async function getPublicActiveEvents(): Promise<PublicActiveEventRow[]> {
  const rows = await prisma.event.findMany({
    where: { status: "active" },
    orderBy: { startAt: "asc" },
    select: publicActiveEventSelect,
  });

  return rows.map((e) => ({
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    coverBlobUrl: e.coverBlobUrl,
    venueName: e.venue.name,
    startAtIso: e.startAt.toISOString(),
  }));
}
