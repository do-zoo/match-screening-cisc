import { Column, Link, Row, Section, Text } from 'react-email'
import { createElement } from 'react'

import { hasAnyClubContact } from '@/lib/branding/club-social-links'
import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'
import type { ClubEmailContactProps } from '@/lib/email-templates/emails/club-email-plain-contact'

const labelStyle = {
  color: T.text,
  fontSize: '12px',
  fontWeight: 600 as const,
  margin: '0 0 6px',
  lineHeight: '1.3',
}

const valueStyle = {
  color: T.textMuted,
  fontSize: '13px',
  lineHeight: '1.5',
  margin: 0,
}

const linkStyle = {
  color: T.primary,
  fontSize: '13px',
  textDecoration: 'underline' as const,
}

function contactColumn(title: string, body: ReturnType<typeof createElement> | null) {
  if (!body) return null
  return createElement(
    Column,
    { style: { verticalAlign: 'top' as const, padding: '0 8px' } },
    createElement(Text, { style: labelStyle }, title),
    body,
  )
}

export function ClubEmailContactFooter(props: ClubEmailContactProps) {
  if (!hasAnyClubContact(props)) return null

  const emailCol =
    props.contactEmail?.trim() ?
      createElement(
        Text,
        { style: valueStyle },
        createElement(Link, { href: `mailto:${props.contactEmail}`, style: linkStyle }, props.contactEmail),
      )
    : null

  const locationCol =
    props.locationText?.trim() ?
      createElement(Text, { style: { ...valueStyle, whiteSpace: 'pre-wrap' as const } }, props.locationText)
    : null

  const socials = props.socialLinks.filter(l => l.label.trim() && l.url.trim())
  const linkColChildren: ReturnType<typeof createElement>[] = []
  if (props.websiteUrl?.trim()) {
    linkColChildren.push(
      createElement(
        Text,
        { style: { ...valueStyle, margin: '0 0 6px' } },
        createElement(Link, { href: props.websiteUrl, style: linkStyle }, 'Website'),
      ),
    )
  }
  for (const s of socials) {
    linkColChildren.push(
      createElement(
        Text,
        { key: `${s.label}-${s.url}`, style: { ...valueStyle, margin: '0 0 6px' } },
        createElement(Link, { href: s.url, style: linkStyle }, s.label),
      ),
    )
  }
  const linkCol =
    linkColChildren.length > 0 ? createElement(Section, { style: { margin: 0 } }, ...linkColChildren) : null

  const cols = [
    contactColumn('Email', emailCol),
    contactColumn('Lokasi', locationCol),
    contactColumn('Tautan', linkCol),
  ].filter(Boolean)

  return createElement(
    Section,
    {
      style: {
        padding: '24px 32px',
        borderTop: `1px solid ${T.cardBorder}`,
        backgroundColor: T.surfaceMuted,
      },
    },
    createElement(Row, null, ...cols),
  )
}
