import type { ReactNode } from 'react'

import { ContactIconRow } from '@/components/branding/contact-icon-row'
import type { ClubSocialLink } from '@/lib/branding/club-social-links'
import { hasAnyClubContact } from '@/lib/branding/club-social-links'
import { detectContactPlatform } from '@/lib/branding/contact-platform'
import {
  resolveContactDisplayLabel,
  websiteLinkLabel,
} from '@/lib/branding/resolve-contact-display-label'

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
      <div className='text-muted-foreground space-y-2 text-sm'>{props.children}</div>
    </div>
  )
}

export function ClubContactDisplay(props: ClubContactDisplayProps) {
  if (!hasAnyClubContact(props)) return null

  const showEmail = Boolean(props.contactEmail?.trim())
  const showLocation = Boolean(props.locationText?.trim())
  const socials = props.socialLinks.filter(l => l.url.trim())
  const showSocial = Boolean(props.websiteUrl?.trim()) || socials.length > 0

  return (
    <div className='grid gap-8 text-sm md:grid-cols-3 md:gap-6'>
      {showEmail ? (
        <ContactColumn title='Email'>
          <ContactIconRow platform='email'>
            <a href={`mailto:${props.contactEmail}`} className='text-primary hover:underline'>
              {props.contactEmail}
            </a>
          </ContactIconRow>
        </ContactColumn>
      ) : null}
      {showLocation ? (
        <ContactColumn title='Lokasi'>
          <ContactIconRow platform='location'>
            <p className='whitespace-pre-wrap'>{props.locationText}</p>
          </ContactIconRow>
        </ContactColumn>
      ) : null}
      {showSocial ? (
        <ContactColumn title='Sosial Media'>
          {props.websiteUrl?.trim() ? (
            <ContactIconRow platform='website'>
              <a
                href={props.websiteUrl!}
                className='text-primary hover:underline'
                rel='noopener noreferrer'
              >
                {websiteLinkLabel()}
              </a>
            </ContactIconRow>
          ) : null}
          {socials.map(link => {
            const platform = detectContactPlatform(link.url)
            const displayLabel = resolveContactDisplayLabel({
              label: link.label,
              url: link.url,
              platform,
            })
            return (
              <ContactIconRow key={`${link.label}-${link.url}`} platform={platform}>
                <a href={link.url} className='text-primary hover:underline' rel='noopener noreferrer'>
                  {displayLabel}
                </a>
              </ContactIconRow>
            )
          })}
        </ContactColumn>
      ) : null}
    </div>
  )
}
