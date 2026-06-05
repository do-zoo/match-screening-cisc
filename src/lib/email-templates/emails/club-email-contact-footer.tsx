import { Column, Hr, Img, Link, Row, Section, Text } from 'react-email'
import { createElement, type ReactNode } from 'react'

import { hasAnyClubContact } from '@/lib/branding/club-social-links'
import { brandingIconAbsoluteUrl } from '@/lib/branding/branding-icon-url'
import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { detectContactPlatform } from '@/lib/branding/contact-platform'
import {
  resolveContactDisplayLabel,
  websiteLinkLabel,
} from '@/lib/branding/resolve-contact-display-label'
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

const iconStyle = {
  display: 'inline-block' as const,
  verticalAlign: 'middle' as const,
  marginRight: '6px',
}

function emailIconTextRow(
  platform: ContactPlatformKey,
  appOrigin: string | null | undefined,
  child: ReactNode,
): ReturnType<typeof createElement> {
  const iconUrl = brandingIconAbsoluteUrl(platform, appOrigin)
  const content =
    iconUrl ?
      [
        createElement(Img, {
          key: 'icon',
          src: iconUrl,
          alt: '',
          width: 16,
          height: 16,
          style: iconStyle,
        }),
        child,
      ]
    : [child]

  return createElement(Text, { style: columnValue }, ...content)
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

export function ClubEmailContactFooter(
  props: ClubEmailContactProps & { clubNameNav: string; appOrigin?: string | null },
) {
  const hasContact = hasAnyClubContact(props)
  const year = new Date().getFullYear()
  const appOrigin = props.appOrigin ?? process.env.BETTER_AUTH_URL ?? null

  const emailChildren: ReturnType<typeof createElement>[] = []
  if (props.contactEmail?.trim()) {
    emailChildren.push(
      emailIconTextRow(
        'email',
        appOrigin,
        createElement(Link, { href: `mailto:${props.contactEmail}`, style: linkStyle }, props.contactEmail),
      ),
    )
  }

  const locationChildren: ReturnType<typeof createElement>[] = []
  if (props.locationText?.trim()) {
    locationChildren.push(
      emailIconTextRow(
        'location',
        appOrigin,
        createElement(Text, { style: { margin: 0, whiteSpace: 'pre-wrap' as const } }, props.locationText),
      ),
    )
  }

  const socialChildren: ReturnType<typeof createElement>[] = []
  if (props.websiteUrl?.trim()) {
    socialChildren.push(
      emailIconTextRow(
        'website',
        appOrigin,
        createElement(Link, { href: props.websiteUrl, style: linkStyle }, websiteLinkLabel()),
      ),
    )
  }
  for (const s of props.socialLinks.filter(l => l.url.trim())) {
    const platform = detectContactPlatform(s.url)
    const displayLabel = resolveContactDisplayLabel({
      label: s.label,
      url: s.url,
      platform,
    })
    socialChildren.push(
      emailIconTextRow(
        platform,
        appOrigin,
        createElement(Link, { key: `${s.label}-${s.url}`, href: s.url, style: linkStyle }, displayLabel),
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
