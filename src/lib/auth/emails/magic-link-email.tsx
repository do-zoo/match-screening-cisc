import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html lang="id">
      <Head />
      <Preview>Link masuk ke Match Screening admin</Preview>
      <Body
        style={{
          backgroundColor: "#f9fafb",
          fontFamily: "sans-serif",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
          }}
        >
          <Text
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              margin: "0 0 8px",
              color: "#18181b",
            }}
          >
            Match Screening
          </Text>
          <Text
            style={{ color: "#374151", lineHeight: "1.6", margin: "0 0 24px" }}
          >
            Klik tombol di bawah untuk masuk ke halaman admin. Link ini hanya
            berlaku sekali dan akan kedaluwarsa dalam 5 menit.
          </Text>
          <Section style={{ textAlign: "center", margin: "0 0 24px" }}>
            <Button
              href={url}
              style={{
                backgroundColor: "#18181b",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "500",
                display: "inline-block",
              }}
            >
              Masuk sekarang
            </Button>
          </Section>
          <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>
            Jika Anda tidak meminta link ini, abaikan email ini.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
