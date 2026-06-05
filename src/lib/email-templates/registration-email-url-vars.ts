/** URL publik acara / konfirmasi untuk placeholder tombol CTA di email registrasi. */
export function buildRegistrationEmailUrlVars(opts: {
  origin?: string
  eventSlug?: string | null
  registrationId?: string
}): Record<string, string> {
  const origin = opts.origin?.replace(/\/$/, '')
  if (!origin || !opts.eventSlug?.trim()) return {}

  const slug = opts.eventSlug.trim()
  const urls: Record<string, string> = {
    event_page_url: `${origin}/events/${slug}`,
  }
  if (opts.registrationId?.trim()) {
    urls.registration_page_url = `${origin}/events/${slug}/register/${opts.registrationId.trim()}`
  }
  return urls
}
