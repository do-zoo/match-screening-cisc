import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

export function AdminVenuesIndexHeader() {
  return (
    <header className='space-y-2'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
        <h1 className='text-2xl font-semibold tracking-tight'>Venue</h1>
        <Link
          href='/admin/venues/new'
          className={buttonVariants({
            variant: 'default',
            size: 'sm',
            className: 'shrink-0 sm:self-center',
          })}
        >
          Venue baru
        </Link>
      </div>
      <p className='text-muted-foreground text-sm'>Kelola katalog lokasi, menu kanonik, dan tautan peta.</p>
    </header>
  )
}
