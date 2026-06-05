import type { WaTemplateKey } from '@prisma/client'

import { WA_TEMPLATE_CATALOG } from '@/lib/wa-templates/wa-template-catalog'

export const CLUB_WA_DEFAULT_BODIES = Object.fromEntries(
  Object.entries(WA_TEMPLATE_CATALOG).map(([k, v]) => [k, v.defaultBody]),
) as Record<WaTemplateKey, string>
