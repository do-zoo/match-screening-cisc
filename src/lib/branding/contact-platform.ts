export type ContactPlatformKey =
  | 'email'
  | 'website'
  | 'location'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'tiktok'
  | 'x'
  | 'linkedin'
  | 'whatsapp'
  | 'threads'
  | 'link'

const HOST_RULES: { key: ContactPlatformKey; hosts: string[] }[] = [
  { key: 'instagram', hosts: ['instagram.com'] },
  { key: 'facebook', hosts: ['facebook.com', 'fb.com', 'm.facebook.com'] },
  { key: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { key: 'tiktok', hosts: ['tiktok.com'] },
  { key: 'x', hosts: ['x.com', 'twitter.com'] },
  { key: 'linkedin', hosts: ['linkedin.com'] },
  { key: 'whatsapp', hosts: ['whatsapp.com', 'wa.me'] },
  { key: 'threads', hosts: ['threads.net'] },
]

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function hostMatchesRule(host: string, ruleHost: string): boolean {
  return host === ruleHost || host.endsWith(`.${ruleHost}`)
}

export function detectContactPlatform(url: string): ContactPlatformKey {
  try {
    const host = normalizeHostname(new URL(url).hostname)
    for (const rule of HOST_RULES) {
      if (rule.hosts.some(h => hostMatchesRule(host, h))) return rule.key
    }
    return 'link'
  } catch {
    return 'link'
  }
}
