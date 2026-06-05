import { Column, Hr, Link, Row, Section, Text } from 'react-email'
import { createElement } from 'react'

import { hasAnyClubContact } from '@/lib/branding/club-social-links'
import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'
import type { ClubEmailContactProps } from '@/lib/email-templates/emails/club-email-plain-contact'

const columnLabel = {
  color: T.footerLabel,
  fontSize: '13px',
  fontWeight: 600 as const,
  margin: '0 0 8px',
  lineHeight: '1.3',
}

const columnValue = {
  color: T.footerText,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 6px',
}

const linkStyle = {
  color: T.footerLink,
  fontSize: '14px',
  textDecoration: 'underline' as const,
}

function footerColumn(title: string, children: ReturnType<typeof createElement>[]) {
  if (children.length === 0) return null
  return createElement(
    Column,
    { style: { verticalAlign: 'top' as const, width: '33.33%', padding: '0 12px' } },
    createElement(Text, { style: columnLabel }, title),
    ...children,
  )
}

export function ClubEmailContactFooter(props: ClubEmailContactProps & { clubNameNav: string }) {
  const hasContact = hasAnyClubContact(props)
  const year = new Date().getFullYear()

  const emailChildren: ReturnType<typeof createElement>[] = []
  if (props.contactEmail?.trim()) {
    emailChildren.push(
      createElement(
        Text,
        { style: columnValue },
        createElement(Link, { href: `mailto:${props.contactEmail}`, style: linkStyle }, props.contactEmail),
      ),
    )
  }

  const locationChildren: ReturnType<typeof createElement>[] = []
  if (props.locationText?.trim()) {
    locationChildren.push(
      createElement(Text, { style: { ...columnValue, whiteSpace: 'pre-wrap' as const } }, props.locationText),
    )
  }

  const socialChildren: ReturnType<typeof createElement>[] = []
  if (props.websiteUrl?.trim()) {
    socialChildren.push(
      createElement(
        Text,
        { style: columnValue },
        createElement(Link, { href: props.websiteUrl, style: linkStyle }, 'Website'),
      ),
    )
  }
  for (const s of props.socialLinks.filter(l => l.label.trim() && l.url.trim())) {
    socialChildren.push(
      createElement(
        Text,
        { key: `${s.label}-${s.url}`, style: columnValue },
        createElement(Link, { href: s.url, style: linkStyle }, s.label),
      ),
    )
  }

  const cols = [
    footerColumn('Email', emailChildren),
    footerColumn('Lokasi', locationChildren),
    footerColumn('Sosial Media', socialChildren),
  ].filter(Boolean)

  return createElement(
    Section,
    {
      style: {
        backgroundColor: T.footerBg,
        padding: hasContact ? '32px 24px 24px' : '24px',
        borderTop: `1px solid ${T.footerBorder}`,
      },
    },
    hasContact && cols.length > 0 ?
      createElement(Row, { style: { marginBottom: '24px' } }, ...cols)
    : null,
    createElement(Hr, { style: { borderColor: T.footerBorder, margin: '0 0 20px' } }),
    createElement(
      Text,
      {
        style: {
          color: T.footerMuted,
          fontSize: '12px',
          lineHeight: '1.6',
          margin: '0 0 8px',
          textAlign: 'center' as const,
        },
      },
      `© ${year} ${props.clubNameNav}`,
    ),
    createElement(
      Text,
      {
        style: {
          color: T.footerMuted,
          fontSize: '11px',
          lineHeight: '1.5',
          margin: 0,
          textAlign: 'center' as const,
        },
      },
      'Email resmi dari komunitas. Mohon tidak membalas ke alamat sistem ini bila tidak diminta.',
    ),
  )
}
