import { Body, Container, Head, Html, Img, Preview, Section, Text } from 'react-email'
import type { ReactNode } from 'react'

import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'
import { ClubEmailContactFooter } from '@/lib/email-templates/emails/club-email-contact-footer'
import type { ClubEmailContactProps } from '@/lib/email-templates/emails/club-email-plain-contact'

export type ClubEmailLayoutProps = {
  preview: string
  clubNameNav: string
  logoBlobUrl?: string | null
  contact: ClubEmailContactProps
  children: ReactNode
}

function ClubEmailHeader(props: { clubNameNav: string; logoBlobUrl?: string | null }) {
  return (
    <Section
      style={{
        padding: '28px 32px 20px',
        borderBottom: `1px solid ${T.cardBorder}`,
        backgroundColor: T.headerBand,
      }}
    >
      {props.logoBlobUrl ? (
        <Img
          src={props.logoBlobUrl}
          alt={props.clubNameNav}
          height={36}
          style={{ display: 'block', margin: '0 0 12px', maxHeight: '36px', width: 'auto' }}
        />
      ) : null}
      <Text
        style={{
          fontSize: '18px',
          fontWeight: 600,
          margin: 0,
          color: T.text,
          letterSpacing: '-0.01em',
          lineHeight: '1.3',
        }}
      >
        {props.clubNameNav}
      </Text>
    </Section>
  )
}

export function ClubEmailLayout(props: ClubEmailLayoutProps) {
  return (
    <Html lang='id'>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: T.pageBg,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          margin: 0,
          padding: 0,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '32px 16px',
          }}
        >
          <Section
            style={{
              backgroundColor: T.cardBg,
              borderRadius: '12px',
              border: `1px solid ${T.cardBorder}`,
              overflow: 'hidden',
            }}
          >
            <ClubEmailHeader clubNameNav={props.clubNameNav} logoBlobUrl={props.logoBlobUrl} />
            {props.children}
            <ClubEmailContactFooter {...props.contact} />
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
