import type { WaTemplateKey } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { ClubWaBodies } from "@/lib/wa-templates/render-wa-from-db";

export async function loadClubWaTemplateBodies(): Promise<ClubWaBodies> {
  const rows = await prisma.clubWaTemplate.findMany({
    select: { key: true, body: true },
  });
  const out: ClubWaBodies = {};
  for (const row of rows) {
    out[row.key as WaTemplateKey] = row.body;
  }
  return out;
}
