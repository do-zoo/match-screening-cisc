import { Body, Container, Head, Html, Preview, Text } from "react-email";

export function OtpEmail({ otp }: { otp: string }) {
  return (
    <Html lang="id">
      <Head />
      <Preview>Kode verifikasi Match Screening: {otp}</Preview>
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
            Kode verifikasi
          </Text>
          <Text style={{ color: "#374151", margin: "0 0 16px" }}>
            Kode 6 digit untuk masuk ke Match Screening:
          </Text>
          <Text
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              letterSpacing: "0.15em",
              textAlign: "center",
              margin: "24px 0",
              fontFamily: "monospace",
              color: "#18181b",
            }}
          >
            {otp}
          </Text>
          <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>
            Kode berlaku selama 5 menit. Jika Anda tidak meminta kode ini,
            abaikan email ini.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
