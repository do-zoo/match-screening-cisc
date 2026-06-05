import type { ReactNode } from 'react'

import type { ClubSocialLink } from '@/lib/branding/club-social-links'
import { hasAnyClubContact } from '@/lib/branding/club-social-links'

export type ClubContactDisplayProps = {
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}

function ContactColumn(props: { title: string; children: ReactNode }) {
  return (
    <div className='space-y-2'>
      <p className='text-primary text-sm font-semibold'>{props.title}</p>
      <div className='text-muted-foreground space-y-1 text-sm'>{props.children}</div>
    </div>
  )
}

export function ClubContactDisplay(props: ClubContactDisplayProps) {
  if (!hasAnyClubContact(props)) return null

  const showEmail = Boolean(props.contactEmail?.trim())
  const showLocation = Boolean(props.locationText?.trim())
  const socials = props.socialLinks.filter(l => l.label.trim() && l.url.trim())
  const showSocial = Boolean(props.websiteUrl?.trim()) || socials.length > 0

  return (
    <div className='grid gap-8 text-sm md:grid-cols-3 md:gap-6'>
      {showEmail ? (
        <ContactColumn title='Email'>
          <a href={`mailto:${props.contactEmail}`} className='text-primary hover:underline'>
            {props.contactEmail}
          </a>
        </ContactColumn>
      ) : null}
      {showLocation ? (
        <ContactColumn title='Lokasi'>
          <p className='whitespace-pre-wrap'>{props.locationText}</p>
        </ContactColumn>
      ) : null}
      {showSocial ? (
        <ContactColumn title='Sosial Media'>
          {props.websiteUrl?.trim() ? (
            <a href={props.websiteUrl!} className='text-primary block hover:underline' rel='noopener noreferrer'>
              Website
            </a>
          ) : null}
          {socials.map(link => (
            <a
              key={`${link.label}-${link.url}`}
              href={link.url}
              className='text-primary block hover:underline'
              rel='noopener noreferrer'
            >
              {link.label}
            </a>
          ))}
        </ContactColumn>
      ) : null}
    </div>
  )
}
