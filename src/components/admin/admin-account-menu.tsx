'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { adminAuthClient } from '@/lib/auth/admin-auth-client'
import { getAdminInitials } from '@/lib/admin/admin-initials'
import { cn } from '@/lib/utils'

function AdminAvatarCircle({
  avatarUrl,
  displayName,
  userEmail,
  size,
}: {
  avatarUrl: string | null | undefined
  displayName: string | null | undefined
  userEmail: string | null | undefined
  size: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 28 : 36
  const cls = size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-[13px]'

  if (avatarUrl) {
    return (
      <span
        className={`${cls} relative shrink-0 overflow-hidden rounded-full border border-sidebar-border/60`}
        aria-hidden
      >
        <Image src={avatarUrl} alt='' width={dim} height={dim} className='h-full w-full object-cover' />
      </span>
    )
  }

  const initials = getAdminInitials(displayName, userEmail)
  return (
    <span
      className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-sidebar-accent font-semibold text-sidebar-foreground`}
      aria-hidden
    >
      {initials}
    </span>
  )
}

type AdminAccountMenuProps = {
  userEmail: string | null
  displayName?: string | null
  avatarUrl?: string | null
  triggerClassName?: string
  /** icon = compact avatar-only button (mobile header) | sidebar = full pill | default = name+chevron pill */
  variant?: 'default' | 'sidebar' | 'icon'
}

export function AdminAccountMenu({
  userEmail,
  displayName,
  avatarUrl,
  triggerClassName,
  variant = 'default',
}: AdminAccountMenuProps) {
  const [open, setOpen] = useState(false)

  const email = userEmail ?? ''
  const name = displayName?.trim() ?? ''
  const primary = name || email || 'Akun'
  const showEmailRow = Boolean(name && email)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {variant === 'icon' ? (
        <PopoverTrigger
          aria-label='Menu akun'
          className={triggerClassName}
          render={
            <Button
              type='button'
              variant='outline'
              className='size-10 shrink-0 rounded-full border-sidebar-border bg-transparent p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            />
          }
        >
          <AdminAvatarCircle avatarUrl={avatarUrl} displayName={displayName} userEmail={userEmail ?? ''} size='md' />
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          aria-label='Menu akun'
          className={cn('w-full', triggerClassName)}
          render={
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={cn(
                'min-h-0 w-full shrink justify-between gap-3 shadow-none',
                variant === 'sidebar'
                  ? 'h-auto! min-h-12! whitespace-normal! rounded-full border-sidebar-border/80 bg-sidebar-accent/35 px-3.5 py-2 text-left hover:bg-sidebar-accent/55'
                  : 'border-transparent bg-transparent px-1 hover:bg-transparent',
              )}
            />
          }
        >
          <AdminAvatarCircle
            avatarUrl={avatarUrl}
            displayName={displayName}
            userEmail={userEmail ?? ''}
            size={variant === 'sidebar' ? 'md' : 'sm'}
          />
          <span className='min-w-0 flex-1 text-left'>
            <span className='block truncate text-sm font-medium leading-snug'>{primary}</span>
            {showEmailRow ? (
              <span
                className={cn(
                  'block truncate text-xs',
                  variant === 'sidebar' ? 'text-sidebar-foreground/55' : 'text-muted-foreground',
                )}
              >
                {email}
              </span>
            ) : null}
          </span>
          <ChevronDownIcon
            className={cn('size-4 shrink-0', variant === 'sidebar' ? 'text-sidebar-foreground/60' : 'opacity-70')}
            aria-hidden
          />
        </PopoverTrigger>
      )}
      <PopoverContent
        className='w-72 p-3'
        align={variant === 'icon' ? 'end' : 'start'}
        side={variant === 'sidebar' ? 'top' : 'bottom'}
        sideOffset={variant === 'sidebar' ? 8 : 4}
      >
        <PopoverHeader className='flex items-center gap-3 px-1 flex-row'>
          <AdminAvatarCircle avatarUrl={avatarUrl} displayName={displayName} userEmail={userEmail ?? ''} size='md' />
          <div className='min-w-0'>
            <PopoverTitle className='truncate text-base'>{primary}</PopoverTitle>
            {email ? <p className='truncate text-xs text-muted-foreground'>{email}</p> : null}
          </div>
        </PopoverHeader>
        <div className='mt-3 flex flex-col gap-1 border-t border-border pt-3'>
          <Link
            href='/admin/account'
            className='flex h-9 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground'
            onClick={() => setOpen(false)}
          >
            Kelola akun…
          </Link>
          <Button
            variant='ghost'
            className='h-9 justify-start px-3 text-destructive hover:bg-destructive/10 hover:text-destructive'
            type='button'
            onClick={async () => {
              setOpen(false)
              await adminAuthClient.signOut()
              window.location.href = '/admin/sign-in'
            }}
          >
            Keluar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
