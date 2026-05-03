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

export function AdminInviteEmail(props: {
  inviteUrl: string;
  roleLabel: string;
}) {
  return (
    <Html lang="id">
      <Head />
      <Preview>Undangan admin Match Screening</Preview>
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
          <Text style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 12px" }}>
            Undangan admin
          </Text>
          <Text style={{ fontSize: "14px", color: "#52525b", margin: "0 0 16px" }}>
            Anda diundang sebagai <strong>{props.roleLabel}</strong>. Selesaikan pengaturan
            kata sandi dan nama pada taut berikut (berlaku terbatas, satu kali pakai).
          </Text>
          <Section style={{ textAlign: "center", marginTop: "24px" }}>
            <Button
              href={props.inviteUrl}
              style={{
                backgroundColor: "#18181b",
                borderRadius: "6px",
                color: "#fff",
                padding: "12px 20px",
                fontWeight: "600",
              }}
            >
              Terima undangan
            </Button>
          </Section>
          <Text
            style={{
              fontSize: "12px",
              color: "#a1a1aa",
              marginTop: "24px",
              wordBreak: "break-all",
            }}
          >
            Atau salin taut: {props.inviteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
