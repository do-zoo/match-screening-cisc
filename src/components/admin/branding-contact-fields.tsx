'use client'

import type { ReactNode } from 'react'

import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { detectContactPlatform } from '@/lib/branding/contact-platform'
import { contactPlatformFromRegistry } from '@/lib/branding/contact-icon-registry'
import { brandingIconPublicPath } from '@/lib/branding/branding-icon-url'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function BrandingContactIconAddon(props: { platform: ContactPlatformKey; className?: string }) {
  return (
    <InputGroupAddon align='inline-start' className={cn('pl-2.5', props.className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brandingIconPublicPath(props.platform)}
        alt=''
        aria-hidden
        width={18}
        height={18}
        className='size-4.5 shrink-0 opacity-80'
      />
    </InputGroupAddon>
  )
}

type BrandingContactInputGroupProps = {
  id: string
  name: string
  label: string
  platform: ContactPlatformKey
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  hint?: string | null
}

export function BrandingContactInputGroup(props: BrandingContactInputGroupProps) {
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={props.id}>{props.label}</Label>
      <InputGroup className='h-9'>
        <BrandingContactIconAddon platform={props.platform} />
        <InputGroupInput
          id={props.id}
          name={props.name}
          type={props.type}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
        />
      </InputGroup>
      {props.hint ? <p className='text-muted-foreground text-xs'>{props.hint}</p> : null}
    </div>
  )
}

export function BrandingContactLocationGroup(props: {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={props.id}>{props.label}</Label>
      <InputGroup className='h-auto min-h-9 items-start'>
        <BrandingContactIconAddon platform='location' className='self-start pt-2.5' />
        <InputGroupTextarea
          id={props.id}
          name={props.name}
          rows={2}
          maxLength={200}
          placeholder={props.placeholder}
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          className='min-h-16 py-2'
        />
      </InputGroup>
    </div>
  )
}

export function socialIconHintFromUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed.startsWith('https://')) return null
  const platform = detectContactPlatform(trimmed)
  const label = contactPlatformFromRegistry(platform).defaultLabel
  if (!label) return null
  return `Terdeteksi: ${label}`
}

export function BrandingSocialUrlHint(props: { url: string }) {
  const hint = socialIconHintFromUrl(props.url)
  if (!hint) return null
  return <p className='text-muted-foreground text-xs'>{hint}</p>
}

export function BrandingContactSection(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className='border-border/80 bg-card/40 space-y-4 rounded-xl border p-4 sm:p-5'>
      <div className='space-y-1'>
        <h3 className='text-sm font-medium'>{props.title}</h3>
        {props.description ? (
          <p className='text-muted-foreground text-xs leading-relaxed'>{props.description}</p>
        ) : null}
      </div>
      {props.children}
    </div>
  )
}
