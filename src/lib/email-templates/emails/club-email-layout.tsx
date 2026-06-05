import { Body, Container, Head, Html, Preview, Section } from 'react-email'
import type { ReactNode } from 'react'

export function ClubEmailLayout(props: { preview: string; children: ReactNode }) {
  return (
    <Html lang='id'>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f4f4f5',
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
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e4e4e7',
              overflow: 'hidden',
            }}
          >
            {props.children}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
