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
  appOrigin?: string | null
  children: ReactNode
}

function ClubEmailHeader(props: { clubNameNav: string; logoBlobUrl?: string | null }) {
  return (
    <Section
      style={{
        padding: '32px 24px',
        textAlign: 'center' as const,
        borderBottom: `1px solid ${T.headerBorder}`,
        backgroundColor: T.headerGradientStart,
        backgroundImage: `linear-gradient(to right, ${T.headerGradientStart}, ${T.headerGradientEnd})`,
      }}
    >
      {props.logoBlobUrl ? (
        <Img
          src={props.logoBlobUrl}
          alt={props.clubNameNav}
          height={40}
          style={{
            display: 'block',
            margin: '0 auto 16px',
            maxHeight: '40px',
            width: 'auto',
          }}
        />
      ) : null}
      <Text
        style={{
          fontSize: '28px',
          fontWeight: 700,
          margin: '0 0 8px',
          color: T.headerText,
          letterSpacing: '-0.02em',
          lineHeight: '1.2',
        }}
      >
        {props.clubNameNav}
      </Text>
    </Section>
  )
}

function ClubEmailBody(props: { children: ReactNode }) {
  return (
    <Section
      style={{
        padding: `${T.bodyPaddingY} ${T.bodyPaddingX}`,
        backgroundColor: T.shellBg,
      }}
    >
      {props.children}
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
            width: '100%',
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: T.shellBg,
            color: T.shellText,
          }}
        >
          <ClubEmailHeader clubNameNav={props.clubNameNav} logoBlobUrl={props.logoBlobUrl} />
          <ClubEmailBody>{props.children}</ClubEmailBody>
          <ClubEmailContactFooter
            {...props.contact}
            clubNameNav={props.clubNameNav}
            appOrigin={props.appOrigin}
          />
        </Container>
      </Body>
    </Html>
  )
}
