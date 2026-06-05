import { ClubContactDisplay, type ClubContactDisplayProps } from '@/components/branding/club-contact-display'
import { hasAnyClubContact } from '@/lib/branding/club-social-links'

export function PublicFooter(props: ClubContactDisplayProps) {
  if (!hasAnyClubContact(props)) return null

  return (
    <footer className='mt-auto border-t border-border bg-background/95 py-8'>
      <div className='mx-auto max-w-6xl px-4 md:px-6'>
        <ClubContactDisplay {...props} />
      </div>
    </footer>
  )
}
