import Link from 'next/link'

import type { WaTemplateIndexRow } from '@/lib/wa-templates/filter-wa-templates-index'
import { waTemplateCategoryLabel } from '@/lib/wa-templates/filter-wa-templates-index'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const fmtDay = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function WaTemplatesCardsView({ rows }: { rows: WaTemplateIndexRow[] }) {
  if (rows.length === 0) {
    return (
      <div className='text-muted-foreground bg-card rounded-lg border border-dashed p-8 text-center text-sm'>
        Tidak ada template untuk filter ini. Ubah kategori atau kata kunci pencarian.
      </div>
    )
  }

  return (
    <ul className='grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3'>
      {rows.map(row => (
        <li key={row.key}>
          <Card className='flex h-full flex-col'>
            <CardHeader className='gap-3'>
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <CardTitle className='text-lg leading-snug'>{row.label}</CardTitle>
                <div className='flex flex-wrap gap-1.5'>
                  <Badge variant='outline'>{waTemplateCategoryLabel(row.category)}</Badge>
                  <Badge variant={row.isCustomized ? 'default' : 'secondary'}>
                    {row.isCustomized ? 'Kustom' : 'Bawaan'}
                  </Badge>
                </div>
              </div>
              <p className='text-muted-foreground text-sm'>{row.description}</p>
              <pre className='text-muted-foreground line-clamp-2 font-mono text-xs whitespace-pre-wrap'>
                {row.bodySnippet}
              </pre>
              {row.updatedAtIso ? (
                <p className='text-muted-foreground text-xs'>
                  Diperbarui {fmtDay.format(new Date(row.updatedAtIso))}
                </p>
              ) : null}
            </CardHeader>
            <CardFooter className='mt-auto border-t pt-4'>
              <Link
                href={`/admin/settings/templates/whatsapp/${row.key}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Edit
              </Link>
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  )
}
