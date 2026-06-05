import type { ClubSocialLink } from '@/lib/branding/club-social-links'
import { hasAnyClubContact } from '@/lib/branding/club-social-links'

export type ClubContactDisplayProps = {
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}

export function ClubContactDisplay(props: ClubContactDisplayProps) {
  if (!hasAnyClubContact(props)) return null

  const showEmail = Boolean(props.contactEmail?.trim())
  const showWebsite = Boolean(props.websiteUrl?.trim())
  const showLocation = Boolean(props.locationText?.trim())
  const socials = props.socialLinks.filter(l => l.label.trim() && l.url.trim())

  return (
    <div className='grid gap-8 text-sm md:grid-cols-3 md:gap-6'>
      {showEmail ? (
        <div className='space-y-1'>
          <p className='text-foreground font-medium'>Email</p>
          <a href={`mailto:${props.contactEmail}`} className='text-primary hover:underline'>
            {props.contactEmail}
          </a>
        </div>
      ) : null}
      {showLocation ? (
        <div className='space-y-1'>
          <p className='text-foreground font-medium'>Lokasi</p>
          <p className='text-muted-foreground whitespace-pre-wrap'>{props.locationText}</p>
        </div>
      ) : null}
      {showWebsite || socials.length > 0 ? (
        <div className='space-y-2'>
          <p className='text-foreground font-medium'>Tautan</p>
          <ul className='text-muted-foreground space-y-1'>
            {showWebsite ? (
              <li>
                <a href={props.websiteUrl!} className='text-primary hover:underline' rel='noopener noreferrer'>
                  Website
                </a>
              </li>
            ) : null}
            {socials.map(link => (
              <li key={`${link.label}-${link.url}`}>
                <a href={link.url} className='text-primary hover:underline' rel='noopener noreferrer'>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
